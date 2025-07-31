/**
 * Zendesk Webhook Processing Service
 * Handles incoming webhook events from Zendesk and processes them
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { zendeskAuthService } from '../zendesk/auth-service';
import { getKafkaService } from '../messaging/kafka';
import { DatabaseService } from '../services/database';

export interface ZendeskWebhookEvent {
  id: string;
  event_type: string;
  event_timestamp: string;
  zendesk_event_version: string;
  subject: string;
  body: any;
  account: {
    subdomain: string;
    id: number;
  };
}

export interface ZendeskTicketEvent extends ZendeskWebhookEvent {
  event_type: 'ticket.created' | 'ticket.updated' | 'ticket.status_changed';
  body: {
    current: ZendeskTicket;
    previous?: ZendeskTicket;
  };
}

export interface ZendeskCommentEvent extends ZendeskWebhookEvent {
  event_type: 'comment.created' | 'comment.updated';
  body: {
    current: ZendeskComment;
    previous?: ZendeskComment;
  };
}

export interface ZendeskTicket {
  id: number;
  external_id?: string;
  type?: string;
  subject?: string;
  description?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  status: 'new' | 'open' | 'pending' | 'hold' | 'solved' | 'closed';
  requester_id: number;
  assignee_id?: number;
  organization_id?: number;
  group_id?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
  custom_fields?: Array<{
    id: number;
    value: any;
  }>;
}

export interface ZendeskComment {
  id: number;
  type: 'Comment' | 'VoiceComment';
  author_id: number;
  body: string;
  html_body?: string;
  plain_body?: string;
  public: boolean;
  attachments?: Array<{
    id: number;
    filename: string;
    url: string;
    content_type: string;
    size: number;
  }>;
  created_at: string;
  via?: {
    channel: string;
    source?: any;
  };
}

/**
 * Zendesk Webhook Processing Service
 */
export class ZendeskWebhookProcessor {
  private kafkaService = getKafkaService();
  private dbService = new DatabaseService();

  /**
   * Process incoming webhook from Zendesk
   */
  async processWebhook(req: Request, res: Response): Promise<void> {
    try {
      const installationId = req.params.installationId;
      const signature = req.headers['x-zendesk-webhook-signature'] as string;
      const payload = JSON.stringify(req.body);

      // Validate installation exists
      const installation =
        await zendeskAuthService.getInstallationByWebhookEndpoint(
          installationId!
        );
      if (!installation) {
        res.status(404).json({
          error: 'Installation not found',
          installationId,
        });
        return;
      }

      // Verify webhook signature
      if (
        !this.verifyWebhookSignature(
          payload,
          signature,
          installation.webhookSecret
        )
      ) {
        res.status(401).json({
          error: 'Invalid webhook signature',
        });
        return;
      }

      // Parse webhook event
      const event = req.body as ZendeskWebhookEvent;

      // Validate event structure
      if (!this.validateWebhookEvent(event)) {
        res.status(400).json({
          error: 'Invalid webhook event structure',
        });
        return;
      }

      // Log webhook receipt
      console.log(
        `Webhook received: ${event.event_type} for ${event.account.subdomain}`,
        {
          eventId: event.id,
          timestamp: event.event_timestamp,
          installationId,
        }
      );

      // Process event based on type
      await this.processEventByType(event, installation);

      // Store webhook event for audit trail
      await this.storeWebhookEvent(event, installationId!);

      // Return success response
      res.status(200).json({
        status: 'processed',
        eventId: event.id,
        eventType: event.event_type,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Process event based on its type
   */
  private async processEventByType(
    event: ZendeskWebhookEvent,
    installation: any
  ): Promise<void> {
    switch (event.event_type) {
      case 'ticket.created':
        await this.processTicketCreated(
          event as ZendeskTicketEvent,
          installation
        );
        break;

      case 'ticket.updated':
        await this.processTicketUpdated(
          event as ZendeskTicketEvent,
          installation
        );
        break;

      case 'ticket.status_changed':
        await this.processTicketStatusChanged(
          event as ZendeskTicketEvent,
          installation
        );
        break;

      case 'comment.created':
        await this.processCommentCreated(
          event as ZendeskCommentEvent,
          installation
        );
        break;

      case 'comment.updated':
        await this.processCommentUpdated(
          event as ZendeskCommentEvent,
          installation
        );
        break;

      default:
        console.log(`Unhandled webhook event type: ${event.event_type}`);
        // Publish generic webhook event for future processing
        await this.kafkaService.publishWebhookEvent({
          type: 'ZENDESK_WEBHOOK',
          source: 'zendesk',
          eventType: event.event_type,
          payload: event.body,
          timestamp: event.event_timestamp,
        });
    }
  }

  /**
   * Process ticket creation event
   */
  private async processTicketCreated(
    event: ZendeskTicketEvent,
    installation: any
  ): Promise<void> {
    const ticket = event.body.current;
    const conversationId = `zendesk-${ticket.id}`;

    // Create conversation record in database
    try {
      await this.dbService.createConversation({
        ticketId: ticket.id.toString(),
        customerId: ticket.requester_id.toString(),
        agentId: ticket.assignee_id?.toString() || '',
        status: this.mapZendeskStatusToInternal(ticket.status) as any,
        subject: ticket.subject || '',
        priority: ticket.priority || 'normal',
        tags: ticket.tags || [],
        source: 'zendesk',
        metadata: {
          zendeskTicketId: ticket.id,
          subdomain: event.account.subdomain,
          installationId: installation.id,
          externalId: ticket.external_id,
          organizationId: ticket.organization_id,
          groupId: ticket.group_id,
          customFields: ticket.custom_fields,
        },
      });
    } catch (error) {
      console.warn('Error creating conversation record:', error);
      // Continue processing even if database fails
    }

    // Publish conversation event to Kafka
    await this.kafkaService.publishConversationEvent({
      type: 'CONVERSATION_CREATED',
      conversationId,
      ticketId: ticket.id.toString(),
      customerId: ticket.requester_id.toString(),
      agentId: ticket.assignee_id?.toString() || '',
      status: this.mapZendeskStatusToInternal(ticket.status) as any,
      metadata: {
        subject: ticket.subject,
        priority: ticket.priority,
        tags: ticket.tags || [],
        subdomain: event.account.subdomain,
        zendeskTicketId: ticket.id,
      },
      timestamp: event.event_timestamp,
    });

    // If ticket has initial description, process it as first message
    if (ticket.description) {
      await this.processInitialMessage(conversationId, ticket, event);
    }
  }

  /**
   * Process ticket update event
   */
  private async processTicketUpdated(
    event: ZendeskTicketEvent,
    installation: any
  ): Promise<void> {
    const ticket = event.body.current;
    const previous = event.body.previous;
    const conversationId = `zendesk-${ticket.id}`;

    // Update conversation record in database
    try {
      // Note: updateConversation method needs to be implemented in DatabaseService
      console.log('Would update conversation:', conversationId, {
        agentId: ticket.assignee_id?.toString(),
        status: this.mapZendeskStatusToInternal(ticket.status),
        subject: ticket.subject,
        priority: ticket.priority,
        tags: ticket.tags || [],
        updatedAt: new Date(event.event_timestamp),
      });
    } catch (error) {
      console.warn('Error updating conversation record:', error);
    }

    // Publish conversation update event
    await this.kafkaService.publishConversationEvent({
      type: 'CONVERSATION_UPDATED',
      conversationId,
      ticketId: ticket.id.toString(),
      customerId: ticket.requester_id.toString(),
      agentId: ticket.assignee_id?.toString() || '',
      status: this.mapZendeskStatusToInternal(ticket.status) as any,
      metadata: {
        subject: ticket.subject,
        priority: ticket.priority,
        tags: ticket.tags || [],
        changes: this.detectTicketChanges(ticket, previous),
        subdomain: event.account.subdomain,
      },
      timestamp: event.event_timestamp,
    });

    // Check for assignment changes
    if (previous && ticket.assignee_id !== previous.assignee_id) {
      await this.processTicketAssignment(
        conversationId,
        ticket,
        previous,
        event
      );
    }
  }

  /**
   * Process ticket status change event
   */
  private async processTicketStatusChanged(
    event: ZendeskTicketEvent,
    installation: any
  ): Promise<void> {
    const ticket = event.body.current;
    const previous = event.body.previous;
    const conversationId = `zendesk-${ticket.id}`;

    // Update conversation status
    try {
      // Note: updateConversation method needs to be implemented in DatabaseService
      console.log('Would update conversation status:', conversationId, {
        status: this.mapZendeskStatusToInternal(ticket.status),
        updatedAt: new Date(event.event_timestamp),
      });
    } catch (error) {
      console.warn('Error updating conversation status:', error);
    }

    // Publish status change event
    await this.kafkaService.publishConversationEvent({
      type: 'CONVERSATION_UPDATED',
      conversationId,
      ticketId: ticket.id.toString(),
      customerId: ticket.requester_id.toString(),
      agentId: ticket.assignee_id?.toString() || '',
      status: this.mapZendeskStatusToInternal(ticket.status) as any,
      metadata: {
        statusChange: {
          from: previous?.status,
          to: ticket.status,
        },
        subdomain: event.account.subdomain,
      },
      timestamp: event.event_timestamp,
    });

    // If ticket is closed/solved, trigger analytics calculation
    if (ticket.status === 'closed' || ticket.status === 'solved') {
      await this.triggerConversationAnalytics(conversationId, event);
    }
  }

  /**
   * Process comment creation event
   */
  private async processCommentCreated(
    event: ZendeskCommentEvent,
    installation: any
  ): Promise<void> {
    const comment = event.body.current;
    const conversationId = `zendesk-${event.subject}`;
    const messageId = `zendesk-comment-${comment.id}`;

    // Determine sender type
    const sender = comment.public ? 'AGENT' : 'CUSTOMER';

    // Create message record in database
    try {
      await this.dbService.createMessage({
        conversationId,
        content: comment.plain_body || comment.body,
        senderType: sender as any,
        senderId: comment.author_id.toString(),
        source: 'zendesk',
        metadata: {
          zendeskCommentId: comment.id,
          authorId: comment.author_id.toString(),
          isPublic: comment.public,
          via: comment.via,
          attachments: comment.attachments,
          subdomain: event.account.subdomain,
        },
      });
    } catch (error) {
      console.warn('Error creating message record:', error);
    }

    // Publish message event to Kafka
    await this.kafkaService.publishMessageEvent({
      type: 'MESSAGE_CREATED',
      messageId,
      conversationId,
      content: comment.plain_body || comment.body,
      sender,
      metadata: {
        zendeskCommentId: comment.id,
        authorId: comment.author_id.toString(),
        isPublic: comment.public,
        hasAttachments: comment.attachments && comment.attachments.length > 0,
        channel: comment.via?.channel,
        subdomain: event.account.subdomain,
      },
      timestamp: event.event_timestamp,
    });

    // Trigger real-time sentiment analysis if enabled
    if (installation.settings?.enable_sentiment_analysis !== false) {
      await this.triggerSentimentAnalysis(messageId, comment, event);
    }

    // Trigger response suggestions if this is a customer message
    if (
      sender === 'CUSTOMER' &&
      installation.settings?.enable_response_suggestions !== false
    ) {
      await this.triggerResponseSuggestions(conversationId, comment, event);
    }
  }

  /**
   * Process comment update event
   */
  private async processCommentUpdated(
    event: ZendeskCommentEvent,
    installation: any
  ): Promise<void> {
    const comment = event.body.current;
    const conversationId = `zendesk-${event.subject}`;
    const messageId = `zendesk-comment-${comment.id}`;

    // Update message record
    try {
      // Note: updateMessage method needs to be implemented in DatabaseService
      console.log('Would update message:', messageId, {
        content: comment.plain_body || comment.body,
        htmlContent: comment.html_body,
        updatedAt: new Date(event.event_timestamp),
      });
    } catch (error) {
      console.warn('Error updating message record:', error);
    }

    // Publish message update event
    await this.kafkaService.publishMessageEvent({
      type: 'MESSAGE_UPDATED',
      messageId,
      conversationId,
      content: comment.plain_body || comment.body,
      sender: comment.public ? 'AGENT' : 'CUSTOMER',
      metadata: {
        zendeskCommentId: comment.id,
        updated: true,
        subdomain: event.account.subdomain,
      },
      timestamp: event.event_timestamp,
    });
  }

  /**
   * Process initial ticket description as first message
   */
  private async processInitialMessage(
    conversationId: string,
    ticket: ZendeskTicket,
    event: ZendeskTicketEvent
  ): Promise<void> {
    const messageId = `zendesk-ticket-${ticket.id}-description`;

    try {
      await this.dbService.createMessage({
        conversationId,
        content: ticket.description!,
        senderType: 'CUSTOMER' as any,
        senderId: ticket.requester_id.toString(),
        source: 'zendesk',
        metadata: {
          zendeskTicketId: ticket.id,
          isInitialDescription: true,
          requesterId: ticket.requester_id.toString(),
          subdomain: event.account.subdomain,
        },
      });
    } catch (error) {
      console.warn('Error creating initial message:', error);
    }

    // Publish initial message event
    await this.kafkaService.publishMessageEvent({
      type: 'MESSAGE_CREATED',
      messageId,
      conversationId,
      content: ticket.description!,
      sender: 'CUSTOMER',
      metadata: {
        zendeskTicketId: ticket.id,
        isInitialDescription: true,
        requesterId: ticket.requester_id.toString(),
        subdomain: event.account.subdomain,
      },
      timestamp: event.event_timestamp,
    });
  }

  /**
   * Process ticket assignment changes
   */
  private async processTicketAssignment(
    conversationId: string,
    ticket: ZendeskTicket,
    previous: ZendeskTicket,
    event: ZendeskTicketEvent
  ): Promise<void> {
    await this.kafkaService.publishAnalyticsEvent({
      type: 'ANALYTICS_COMPUTED',
      conversationId,
      agentId: ticket.assignee_id?.toString() || '',
      metricType: 'assignment',
      value: 1,
      aggregationType: 'COUNT',
      timeWindow: 'day',
      metadata: {
        previousAgentId: previous.assignee_id?.toString(),
        ticketId: ticket.id.toString(),
        subdomain: event.account.subdomain,
        assignmentTime: event.event_timestamp,
      },
      timestamp: event.event_timestamp,
    });
  }

  /**
   * Trigger sentiment analysis for a message
   */
  private async triggerSentimentAnalysis(
    messageId: string,
    comment: ZendeskComment,
    event: ZendeskCommentEvent
  ): Promise<void> {
    // This would integrate with AI/ML service for actual sentiment analysis
    // For now, we'll publish an event that the AI service can consume
    await this.kafkaService.publishWebhookEvent({
      type: 'ZENDESK_WEBHOOK',
      source: 'zendesk',
      eventType: 'sentiment_analysis_request',
      payload: {
        messageId,
        content: comment.plain_body || comment.body,
        conversationId: `zendesk-${event.subject}`,
        metadata: {
          commentId: comment.id,
          authorId: comment.author_id,
          subdomain: event.account.subdomain,
        },
      },
      timestamp: event.event_timestamp,
    });
  }

  /**
   * Trigger response suggestions for a customer message
   */
  private async triggerResponseSuggestions(
    conversationId: string,
    comment: ZendeskComment,
    event: ZendeskCommentEvent
  ): Promise<void> {
    // This would integrate with AI/ML service for response generation
    await this.kafkaService.publishWebhookEvent({
      type: 'ZENDESK_WEBHOOK',
      source: 'zendesk',
      eventType: 'response_suggestion_request',
      payload: {
        conversationId,
        content: comment.plain_body || comment.body,
        metadata: {
          commentId: comment.id,
          authorId: comment.author_id,
          subdomain: event.account.subdomain,
        },
      },
      timestamp: event.event_timestamp,
    });
  }

  /**
   * Trigger conversation analytics calculation
   */
  private async triggerConversationAnalytics(
    conversationId: string,
    event: ZendeskTicketEvent
  ): Promise<void> {
    await this.kafkaService.publishAnalyticsEvent({
      type: 'ANALYTICS_COMPUTED',
      conversationId,
      metricType: 'conversation_completed',
      value: 1,
      aggregationType: 'COUNT',
      timeWindow: 'day',
      metadata: {
        ticketId: event.body.current.id.toString(),
        status: event.body.current.status,
        subdomain: event.account.subdomain,
        completedAt: event.event_timestamp,
      },
      timestamp: event.event_timestamp,
    });
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    return zendeskAuthService.verifyWebhookSignature(
      payload,
      signature,
      secret
    );
  }

  /**
   * Validate webhook event structure
   */
  private validateWebhookEvent(event: any): event is ZendeskWebhookEvent {
    return (
      event &&
      typeof event.id === 'string' &&
      typeof event.event_type === 'string' &&
      typeof event.event_timestamp === 'string' &&
      event.account &&
      typeof event.account.subdomain === 'string'
    );
  }

  /**
   * Map Zendesk ticket status to internal status
   */
  private mapZendeskStatusToInternal(zendeskStatus: string): string {
    const statusMap: Record<string, string> = {
      new: 'OPEN',
      open: 'OPEN',
      pending: 'WAITING',
      hold: 'ON_HOLD',
      solved: 'RESOLVED',
      closed: 'CLOSED',
    };

    return statusMap[zendeskStatus] || 'OPEN';
  }

  /**
   * Detect changes between current and previous ticket
   */
  private detectTicketChanges(
    current: ZendeskTicket,
    previous?: ZendeskTicket
  ): Record<string, any> {
    if (!previous) return {};

    const changes: Record<string, any> = {};

    // Check for status changes
    if (current.status !== previous.status) {
      changes.status = { from: previous.status, to: current.status };
    }

    // Check for priority changes
    if (current.priority !== previous.priority) {
      changes.priority = { from: previous.priority, to: current.priority };
    }

    // Check for assignee changes
    if (current.assignee_id !== previous.assignee_id) {
      changes.assignee = {
        from: previous.assignee_id,
        to: current.assignee_id,
      };
    }

    // Check for subject changes
    if (current.subject !== previous.subject) {
      changes.subject = { from: previous.subject, to: current.subject };
    }

    // Check for tag changes
    if (
      JSON.stringify(current.tags?.sort()) !==
      JSON.stringify(previous.tags?.sort())
    ) {
      changes.tags = { from: previous.tags, to: current.tags };
    }

    return changes;
  }

  /**
   * Store webhook event for audit trail
   */
  private async storeWebhookEvent(
    event: ZendeskWebhookEvent,
    installationId: string
  ): Promise<void> {
    try {
      // In a real implementation, you'd store this in a webhook_events table
      console.log('Storing webhook event for audit:', {
        eventId: event.id,
        eventType: event.event_type,
        installationId,
        timestamp: event.event_timestamp,
      });
    } catch (error) {
      console.error('Error storing webhook event:', error);
    }
  }

  /**
   * Get webhook processing statistics
   */
  getStats(): {
    processed: number;
    errors: number;
    types: Record<string, number>;
  } {
    // In a real implementation, you'd maintain these statistics
    return {
      processed: 0,
      errors: 0,
      types: {},
    };
  }
}

// Export singleton instance
export const zendeskWebhookProcessor = new ZendeskWebhookProcessor();
