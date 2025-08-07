/**
 * Training Analytics Service
 * Provides comprehensive analytics for training programs, certifications, and learning outcomes
 */

import { DatabaseService } from './database';
import { EventProcessor } from '../events/event-processor';

export interface TrainingParticipant {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'agent' | 'manager' | 'admin' | 'partner';
  organization: string;
  enrollmentDate: Date;
  lastActivityDate: Date;
  totalLearningHours: number;
  certificationLevel: 'none' | 'foundation' | 'professional' | 'expert';
  certificationDate?: Date;
  status: 'active' | 'inactive' | 'completed' | 'dropped';
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: 'foundation' | 'advanced' | 'specialty' | 'certification';
  duration: number; // minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  prerequisites: string[];
  learningObjectives: string[];
  assessmentRequired: boolean;
  certificationCredit: number; // CEU credits
}

export interface LearningPath {
  id: string;
  name: string;
  description: string;
  targetRole: string[];
  modules: string[]; // module IDs in sequence
  estimatedDuration: number; // total minutes
  completionCriteria: {
    requiredModules: string[];
    minimumScore: number;
    practicalAssessment: boolean;
  };
}

export interface TrainingProgress {
  participantId: string;
  moduleId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  startDate: Date;
  completionDate?: Date;
  timeSpent: number; // minutes
  attempts: number;
  scores: {
    assessmentScore?: number;
    practicalScore?: number;
    finalScore?: number;
  };
  feedback?: string;
  next_steps?: string;
}

export interface TrainingEvent {
  id: string;
  participantId: string;
  moduleId: string;
  eventType: 'started' | 'progress' | 'completed' | 'assessment' | 'feedback';
  timestamp: Date;
  data: any;
  sessionId: string;
}

export interface TrainingMetrics {
  overall: {
    totalParticipants: number;
    activeParticipants: number;
    completionRate: number;
    averageScore: number;
    totalLearningHours: number;
  };
  byModule: {
    moduleId: string;
    title: string;
    enrollments: number;
    completions: number;
    averageScore: number;
    averageTime: number;
    satisfactionRating: number;
  }[];
  byRole: {
    role: string;
    participants: number;
    completionRate: number;
    averageScore: number;
    certificationRate: number;
  }[];
  trends: {
    period: string;
    enrollments: number;
    completions: number;
    dropouts: number;
    averageScore: number;
  }[];
}

export interface CertificationMetrics {
  totalCertified: number;
  certificationRate: number;
  averageTimeToCompletion: number;
  retentionRate: number;
  recertificationRate: number;
  byLevel: {
    level: string;
    certified: number;
    averageScore: number;
    timeToCompletion: number;
  }[];
}

export class TrainingAnalyticsService {
  private db: DatabaseService;
  private eventProcessor: EventProcessor;

  constructor() {
    this.db = new DatabaseService();
    this.eventProcessor = new EventProcessor();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventProcessor.on('training.module.started', this.handleModuleStarted.bind(this));
    this.eventProcessor.on('training.module.progress', this.handleModuleProgress.bind(this));
    this.eventProcessor.on('training.module.completed', this.handleModuleCompleted.bind(this));
    this.eventProcessor.on('training.assessment.submitted', this.handleAssessmentSubmitted.bind(this));
    this.eventProcessor.on('training.feedback.provided', this.handleFeedbackProvided.bind(this));
  }

  // Participant Management
  async enrollParticipant(participant: Omit<TrainingParticipant, 'id' | 'enrollmentDate' | 'lastActivityDate' | 'totalLearningHours' | 'status'>): Promise<string> {
    const newParticipant: TrainingParticipant = {
      ...participant,
      id: `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      enrollmentDate: new Date(),
      lastActivityDate: new Date(),
      totalLearningHours: 0,
      status: 'active'
    };

    const participantId = await this.db.createRecord('training_participants', newParticipant);

    // Track enrollment event
    await this.trackEvent({
      id: `event_${Date.now()}`,
      participantId: newParticipant.id,
      moduleId: 'enrollment',
      eventType: 'started',
      timestamp: new Date(),
      data: { participant: newParticipant },
      sessionId: `session_${Date.now()}`
    });

    return participantId;
  }

  async getParticipant(participantId: string): Promise<TrainingParticipant | null> {
    return await this.db.findByField('training_participants', 'id', participantId);
  }

  async updateParticipantProgress(participantId: string, updates: Partial<TrainingParticipant>): Promise<void> {
    await this.db.updateRecord('training_participants', participantId, {
      ...updates,
      lastActivityDate: new Date()
    });
  }

  // Learning Path Management
  async createLearningPath(path: Omit<LearningPath, 'id'>): Promise<string> {
    const newPath: LearningPath = {
      ...path,
      id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    return await this.db.createRecord('learning_paths', newPath);
  }

  async getLearningPath(pathId: string): Promise<LearningPath | null> {
    return await this.db.findByField('learning_paths', 'id', pathId);
  }

  async getRecommendedLearningPaths(role: string, currentCertification: string): Promise<LearningPath[]> {
    const paths = await this.db.findByField('learning_paths', 'targetRole', role);
    
    // Filter and rank based on current certification level and role
    return paths
      .filter(path => this.isPathAppropriate(path, currentCertification))
      .sort((a, b) => this.calculatePathPriority(a, role, currentCertification) - 
                     this.calculatePathPriority(b, role, currentCertification));
  }

  private isPathAppropriate(path: LearningPath, currentCertification: string): boolean {
    // Logic to determine if learning path is appropriate for current certification level
    const certificationOrder = ['none', 'foundation', 'professional', 'expert'];
    const currentLevel = certificationOrder.indexOf(currentCertification);
    
    // Return paths that are at or slightly above current level
    return true; // Simplified for now
  }

  private calculatePathPriority(path: LearningPath, role: string, certification: string): number {
    // Calculate priority score based on role match, prerequisites, and progression
    let priority = 0;
    
    if (path.targetRole.includes(role)) priority += 10;
    if (path.name.toLowerCase().includes(certification)) priority += 5;
    
    return priority;
  }

  // Progress Tracking
  async startModule(participantId: string, moduleId: string): Promise<void> {
    const progress: TrainingProgress = {
      participantId,
      moduleId,
      status: 'in_progress',
      startDate: new Date(),
      timeSpent: 0,
      attempts: 1,
      scores: {}
    };

    await this.db.createRecord('training_progress', progress);

    await this.trackEvent({
      id: `event_${Date.now()}`,
      participantId,
      moduleId,
      eventType: 'started',
      timestamp: new Date(),
      data: { progress },
      sessionId: `session_${Date.now()}`
    });
  }

  async updateModuleProgress(participantId: string, moduleId: string, updates: Partial<TrainingProgress>): Promise<void> {
    const existingProgress = await this.db.findByFields('training_progress', { participantId, moduleId });
    
    if (existingProgress) {
      await this.db.updateRecord('training_progress', existingProgress.id, {
        ...updates,
        timeSpent: existingProgress.timeSpent + (updates.timeSpent || 0)
      });

      await this.trackEvent({
        id: `event_${Date.now()}`,
        participantId,
        moduleId,
        eventType: 'progress',
        timestamp: new Date(),
        data: { updates },
        sessionId: `session_${Date.now()}`
      });
    }
  }

  async completeModule(participantId: string, moduleId: string, finalScore: number, feedback?: string): Promise<void> {
    const progress = await this.db.findByFields('training_progress', { participantId, moduleId });
    
    if (progress) {
      await this.db.updateRecord('training_progress', progress.id, {
        status: 'completed',
        completionDate: new Date(),
        scores: { ...progress.scores, finalScore },
        feedback
      });

      // Update participant learning hours
      const module = await this.db.findByField('training_modules', 'id', moduleId);
      if (module) {
        const participant = await this.getParticipant(participantId);
        if (participant) {
          await this.updateParticipantProgress(participantId, {
            totalLearningHours: participant.totalLearningHours + (module.duration / 60)
          });
        }
      }

      await this.trackEvent({
        id: `event_${Date.now()}`,
        participantId,
        moduleId,
        eventType: 'completed',
        timestamp: new Date(),
        data: { finalScore, feedback },
        sessionId: `session_${Date.now()}`
      });
    }
  }

  // Analytics & Reporting
  async getOverallMetrics(dateRange?: { start: Date; end: Date }): Promise<TrainingMetrics> {
    const participants = await this.db.findAll('training_participants');
    const progress = await this.db.findAll('training_progress');
    const modules = await this.db.findAll('training_modules');

    // Filter by date range if provided
    const filteredParticipants = dateRange 
      ? participants.filter(p => p.enrollmentDate >= dateRange.start && p.enrollmentDate <= dateRange.end)
      : participants;

    const overall = {
      totalParticipants: filteredParticipants.length,
      activeParticipants: filteredParticipants.filter(p => p.status === 'active').length,
      completionRate: this.calculateCompletionRate(filteredParticipants, progress),
      averageScore: this.calculateAverageScore(progress),
      totalLearningHours: filteredParticipants.reduce((sum, p) => sum + p.totalLearningHours, 0)
    };

    const byModule = modules.map(module => ({
      moduleId: module.id,
      title: module.title,
      enrollments: progress.filter(p => p.moduleId === module.id).length,
      completions: progress.filter(p => p.moduleId === module.id && p.status === 'completed').length,
      averageScore: this.calculateModuleAverageScore(module.id, progress),
      averageTime: this.calculateModuleAverageTime(module.id, progress),
      satisfactionRating: await this.getModuleSatisfactionRating(module.id)
    }));

    const roleGroups = this.groupParticipantsByRole(filteredParticipants);
    const byRole = Object.keys(roleGroups).map(role => ({
      role,
      participants: roleGroups[role].length,
      completionRate: this.calculateRoleCompletionRate(roleGroups[role], progress),
      averageScore: this.calculateRoleAverageScore(roleGroups[role], progress),
      certificationRate: this.calculateCertificationRate(roleGroups[role])
    }));

    const trends = await this.calculateTrends(dateRange);

    return {
      overall,
      byModule,
      byRole,
      trends
    };
  }

  async getParticipantMetrics(participantId: string): Promise<any> {
    const participant = await this.getParticipant(participantId);
    const progress = await this.db.findByField('training_progress', 'participantId', participantId);
    const events = await this.db.findByField('training_events', 'participantId', participantId);

    if (!participant) return null;

    const completedModules = progress.filter(p => p.status === 'completed');
    const inProgressModules = progress.filter(p => p.status === 'in_progress');
    const averageScore = completedModules.length > 0 
      ? completedModules.reduce((sum, p) => sum + (p.scores.finalScore || 0), 0) / completedModules.length
      : 0;

    return {
      participant,
      summary: {
        modulesCompleted: completedModules.length,
        modulesInProgress: inProgressModules.length,
        totalTimeSpent: progress.reduce((sum, p) => sum + p.timeSpent, 0),
        averageScore,
        learningStreak: await this.calculateLearningStreak(participantId, events),
        nextRecommendedModule: await this.getNextRecommendedModule(participantId)
      },
      progress: progress.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
      recentActivity: events
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
    };
  }

  async getCertificationMetrics(): Promise<CertificationMetrics> {
    const participants = await this.db.findAll('training_participants');
    const certifiedParticipants = participants.filter(p => p.certificationLevel !== 'none');

    const totalCertified = certifiedParticipants.length;
    const certificationRate = participants.length > 0 ? totalCertified / participants.length : 0;
    
    const averageTimeToCompletion = await this.calculateAverageTimeToCompletion(certifiedParticipants);
    const retentionRate = await this.calculateCertificationRetentionRate();
    const recertificationRate = await this.calculateRecertificationRate();

    const levels = ['foundation', 'professional', 'expert'];
    const byLevel = levels.map(level => {
      const levelParticipants = certifiedParticipants.filter(p => p.certificationLevel === level);
      return {
        level,
        certified: levelParticipants.length,
        averageScore: this.calculateLevelAverageScore(levelParticipants),
        timeToCompletion: this.calculateLevelTimeToCompletion(levelParticipants)
      };
    });

    return {
      totalCertified,
      certificationRate,
      averageTimeToCompletion,
      retentionRate,
      recertificationRate,
      byLevel
    };
  }

  // Event Tracking
  private async trackEvent(event: TrainingEvent): Promise<void> {
    await this.db.createRecord('training_events', event);
    await this.eventProcessor.publish('training.event.tracked', event);
  }

  // Event Handlers
  private async handleModuleStarted(event: any): Promise<void> {
    const { participantId, moduleId } = event.data;
    await this.startModule(participantId, moduleId);
  }

  private async handleModuleProgress(event: any): Promise<void> {
    const { participantId, moduleId, progress } = event.data;
    await this.updateModuleProgress(participantId, moduleId, progress);
  }

  private async handleModuleCompleted(event: any): Promise<void> {
    const { participantId, moduleId, score, feedback } = event.data;
    await this.completeModule(participantId, moduleId, score, feedback);
  }

  private async handleAssessmentSubmitted(event: any): Promise<void> {
    const { participantId, moduleId, score, answers } = event.data;
    
    await this.updateModuleProgress(participantId, moduleId, {
      scores: { assessmentScore: score },
      attempts: 1 // This should be incremented properly
    });

    await this.trackEvent({
      id: `event_${Date.now()}`,
      participantId,
      moduleId,
      eventType: 'assessment',
      timestamp: new Date(),
      data: { score, answers },
      sessionId: `session_${Date.now()}`
    });
  }

  private async handleFeedbackProvided(event: any): Promise<void> {
    const { participantId, moduleId, feedback, rating } = event.data;
    
    await this.updateModuleProgress(participantId, moduleId, { feedback });

    await this.trackEvent({
      id: `event_${Date.now()}`,
      participantId,
      moduleId,
      eventType: 'feedback',
      timestamp: new Date(),
      data: { feedback, rating },
      sessionId: `session_${Date.now()}`
    });
  }

  // Helper Methods
  private calculateCompletionRate(participants: TrainingParticipant[], progress: TrainingProgress[]): number {
    if (participants.length === 0) return 0;
    
    const completedParticipants = participants.filter(p => 
      progress.some(prog => prog.participantId === p.id && prog.status === 'completed')
    );
    
    return completedParticipants.length / participants.length;
  }

  private calculateAverageScore(progress: TrainingProgress[]): number {
    const scoresWithValues = progress
      .filter(p => p.scores.finalScore !== undefined)
      .map(p => p.scores.finalScore!);
    
    return scoresWithValues.length > 0
      ? scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length
      : 0;
  }

  private calculateModuleAverageScore(moduleId: string, progress: TrainingProgress[]): number {
    const moduleProgress = progress.filter(p => p.moduleId === moduleId && p.scores.finalScore !== undefined);
    return moduleProgress.length > 0
      ? moduleProgress.reduce((sum, p) => sum + (p.scores.finalScore || 0), 0) / moduleProgress.length
      : 0;
  }

  private calculateModuleAverageTime(moduleId: string, progress: TrainingProgress[]): number {
    const moduleProgress = progress.filter(p => p.moduleId === moduleId && p.status === 'completed');
    return moduleProgress.length > 0
      ? moduleProgress.reduce((sum, p) => sum + p.timeSpent, 0) / moduleProgress.length
      : 0;
  }

  private async getModuleSatisfactionRating(moduleId: string): Promise<number> {
    // This would typically come from feedback data
    return 4.2; // Placeholder
  }

  private groupParticipantsByRole(participants: TrainingParticipant[]): { [role: string]: TrainingParticipant[] } {
    return participants.reduce((groups, participant) => {
      const role = participant.role;
      if (!groups[role]) groups[role] = [];
      groups[role].push(participant);
      return groups;
    }, {} as { [role: string]: TrainingParticipant[] });
  }

  private calculateRoleCompletionRate(roleParticipants: TrainingParticipant[], progress: TrainingProgress[]): number {
    // Similar to overall completion rate but filtered by role
    return this.calculateCompletionRate(roleParticipants, progress);
  }

  private calculateRoleAverageScore(roleParticipants: TrainingParticipant[], progress: TrainingProgress[]): number {
    const roleProgress = progress.filter(p => 
      roleParticipants.some(rp => rp.id === p.participantId)
    );
    return this.calculateAverageScore(roleProgress);
  }

  private calculateCertificationRate(roleParticipants: TrainingParticipant[]): number {
    const certified = roleParticipants.filter(p => p.certificationLevel !== 'none');
    return roleParticipants.length > 0 ? certified.length / roleParticipants.length : 0;
  }

  private async calculateTrends(dateRange?: { start: Date; end: Date }): Promise<any[]> {
    // This would calculate trends over time periods
    // Placeholder implementation
    return [
      { period: '2024-12', enrollments: 45, completions: 32, dropouts: 5, averageScore: 87.5 },
      { period: '2025-01', enrollments: 52, completions: 38, dropouts: 3, averageScore: 89.2 }
    ];
  }

  private async calculateLearningStreak(participantId: string, events: TrainingEvent[]): Promise<number> {
    // Calculate consecutive days with learning activity
    const activityDates = events
      .filter(e => e.eventType === 'progress' || e.eventType === 'completed')
      .map(e => e.timestamp.toDateString())
      .filter((date, index, arr) => arr.indexOf(date) === index)
      .sort();

    let streak = 0;
    let currentDate = new Date();
    
    for (let i = activityDates.length - 1; i >= 0; i--) {
      const activityDate = new Date(activityDates[i]);
      const daysDiff = Math.floor((currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
        currentDate = activityDate;
      } else {
        break;
      }
    }

    return streak;
  }

  private async getNextRecommendedModule(participantId: string): Promise<string | null> {
    // Logic to recommend next module based on completed modules and learning path
    const participant = await this.getParticipant(participantId);
    const progress = await this.db.findByField('training_progress', 'participantId', participantId);
    
    if (!participant) return null;

    const completedModuleIds = progress
      .filter(p => p.status === 'completed')
      .map(p => p.moduleId);

    // Find learning paths for this role
    const recommendedPaths = await this.getRecommendedLearningPaths(participant.role, participant.certificationLevel);
    
    for (const path of recommendedPaths) {
      for (const moduleId of path.modules) {
        if (!completedModuleIds.includes(moduleId)) {
          return moduleId;
        }
      }
    }

    return null;
  }

  private async calculateAverageTimeToCompletion(certifiedParticipants: TrainingParticipant[]): Promise<number> {
    const timesToCompletion = certifiedParticipants
      .filter(p => p.certificationDate)
      .map(p => {
        const enrollmentTime = p.enrollmentDate.getTime();
        const certificationTime = p.certificationDate!.getTime();
        return certificationTime - enrollmentTime;
      });

    return timesToCompletion.length > 0
      ? timesToCompletion.reduce((sum, time) => sum + time, 0) / timesToCompletion.length
      : 0;
  }

  private async calculateCertificationRetentionRate(): Promise<number> {
    // Calculate how many people maintain their certification
    // Placeholder implementation
    return 0.85;
  }

  private async calculateRecertificationRate(): Promise<number> {
    // Calculate how many people successfully recertify
    // Placeholder implementation
    return 0.78;
  }

  private calculateLevelAverageScore(levelParticipants: TrainingParticipant[]): number {
    // This would typically look at certification exam scores
    // Placeholder implementation
    return 87.5;
  }

  private calculateLevelTimeToCompletion(levelParticipants: TrainingParticipant[]): number {
    // Calculate average time to complete certification for this level
    return this.calculateAverageTimeToCompletion(levelParticipants);
  }

  // Advanced Analytics Methods
  async generateLearningRecommendations(participantId: string): Promise<any> {
    const participant = await this.getParticipant(participantId);
    const progress = await this.db.findByField('training_progress', 'participantId', participantId);
    
    if (!participant) return null;

    const recommendations = {
      nextModules: await this.getPersonalizedModuleRecommendations(participant, progress),
      skillGaps: await this.identifySkillGaps(participant, progress),
      learningPath: await this.suggestOptimalLearningPath(participant, progress),
      peerComparison: await this.generatePeerComparison(participant, progress)
    };

    return recommendations;
  }

  private async getPersonalizedModuleRecommendations(participant: TrainingParticipant, progress: TrainingProgress[]): Promise<any[]> {
    // AI-powered module recommendations based on learning history, role, and performance
    // Placeholder implementation
    return [];
  }

  private async identifySkillGaps(participant: TrainingParticipant, progress: TrainingProgress[]): Promise<any[]> {
    // Identify areas where the participant needs improvement
    // Placeholder implementation
    return [];
  }

  private async suggestOptimalLearningPath(participant: TrainingParticipant, progress: TrainingProgress[]): Promise<any> {
    // Suggest the most efficient learning path to achieve goals
    // Placeholder implementation
    return {};
  }

  private async generatePeerComparison(participant: TrainingParticipant, progress: TrainingProgress[]): Promise<any> {
    // Compare performance with similar participants
    // Placeholder implementation
    return {};
  }
}

export default TrainingAnalyticsService;