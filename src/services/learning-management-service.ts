/**
 * Learning Management Service
 * Core LMS functionality for managing training content, progress, and user experience
 */

import { DatabaseService } from './database';
import { EventProcessor } from '../events/event-processor';
import { TrainingAnalyticsService } from './training-analytics-service';

export interface LMSUser {
  id: string;
  email: string;
  name: string;
  role: 'learner' | 'instructor' | 'admin';
  department: string;
  manager?: string;
  preferences: {
    language: string;
    timezone: string;
    learningPace: 'slow' | 'normal' | 'fast';
    preferredFormats: string[];
  };
  profile: {
    currentLevel: string;
    goals: string[];
    interests: string[];
    availability: {
      hoursPerWeek: number;
      preferredTimes: string[];
    };
  };
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  format: 'video' | 'interactive' | 'assessment' | 'mixed';
  prerequisites: string[];
  learning_objectives: string[];
  content: {
    modules: CourseModule[];
    resources: Resource[];
    assessments: Assessment[];
  };
  metadata: {
    author: string;
    createdDate: Date;
    lastUpdated: Date;
    version: string;
    tags: string[];
  };
  settings: {
    isPublished: boolean;
    enrollmentRequired: boolean;
    completionCriteria: {
      modulesRequired: string[];
      minimumScore: number;
      timeRequirement?: number;
    };
  };
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order: number;
  type: 'video' | 'text' | 'interactive' | 'quiz' | 'simulation';
  content: {
    url?: string;
    text?: string;
    media?: MediaContent[];
    interactions?: InteractiveElement[];
  };
  duration: number;
  isRequired: boolean;
}

export interface MediaContent {
  type: 'video' | 'audio' | 'image' | 'document';
  url: string;
  title: string;
  duration?: number;
  size?: number;
  transcript?: string;
}

export interface InteractiveElement {
  type: 'drag-drop' | 'click-reveal' | 'scenario' | 'simulation';
  config: any;
  feedback: {
    correct: string;
    incorrect: string;
    hint?: string;
  };
}

export interface Assessment {
  id: string;
  courseId: string;
  moduleId?: string;
  title: string;
  type: 'quiz' | 'assignment' | 'practical' | 'peer-review';
  questions: Question[];
  settings: {
    timeLimit?: number;
    attemptsAllowed: number;
    passingScore: number;
    showCorrectAnswers: boolean;
    randomizeQuestions: boolean;
  };
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'matching';
  text: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Resource {
  id: string;
  title: string;
  type: 'document' | 'link' | 'video' | 'tool';
  url: string;
  description: string;
  category: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  enrollmentDate: Date;
  startDate?: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  status: 'enrolled' | 'active' | 'completed' | 'dropped' | 'paused';
  progress: {
    modulesCompleted: string[];
    currentModule?: string;
    overallProgress: number; // 0-100
    timeSpent: number; // in minutes
    lastActivity: Date;
  };
  performance: {
    averageScore: number;
    assessmentScores: { [assessmentId: string]: number };
    attempts: { [assessmentId: string]: number };
  };
}

export interface LearningSession {
  id: string;
  userId: string;
  courseId: string;
  moduleId?: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  activities: SessionActivity[];
  completion: {
    completed: boolean;
    progress: number;
    score?: number;
  };
}

export interface SessionActivity {
  timestamp: Date;
  type: 'video-play' | 'video-pause' | 'question-answered' | 'resource-accessed' | 'note-taken';
  data: any;
}

export class LearningManagementService {
  private db: DatabaseService;
  private eventProcessor: EventProcessor;
  private analyticsService: TrainingAnalyticsService;

  constructor() {
    this.db = new DatabaseService();
    this.eventProcessor = new EventProcessor();
    this.analyticsService = new TrainingAnalyticsService();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.eventProcessor.on('lms.user.enrolled', this.handleUserEnrolled.bind(this));
    this.eventProcessor.on('lms.session.started', this.handleSessionStarted.bind(this));
    this.eventProcessor.on('lms.session.completed', this.handleSessionCompleted.bind(this));
    this.eventProcessor.on('lms.assessment.submitted', this.handleAssessmentSubmitted.bind(this));
  }

  // User Management
  async createUser(userData: Omit<LMSUser, 'id'>): Promise<string> {
    const newUser: LMSUser = {
      ...userData,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const userId = await this.db.createRecord('lms_users', newUser);
    
    await this.eventProcessor.publish('lms.user.created', { user: newUser });
    
    return userId;
  }

  async getUser(userId: string): Promise<LMSUser | null> {
    return await this.db.findByField('lms_users', 'id', userId);
  }

  async updateUserProfile(userId: string, updates: Partial<LMSUser>): Promise<void> {
    await this.db.updateRecord('lms_users', userId, updates);
    await this.eventProcessor.publish('lms.user.updated', { userId, updates });
  }

  async getUserDashboard(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    const enrollments = await this.getUserEnrollments(userId);
    const recentActivity = await this.getUserRecentActivity(userId);
    const recommendations = await this.getPersonalizedRecommendations(userId);

    return {
      user,
      enrollments: enrollments.slice(0, 5), // Recent enrollments
      recentActivity: recentActivity.slice(0, 10),
      recommendations,
      progress: await this.getUserProgress(userId),
      achievements: await this.getUserAchievements(userId),
      upcomingDeadlines: await this.getUpcomingDeadlines(userId)
    };
  }

  // Course Management
  async createCourse(courseData: Omit<Course, 'id'>): Promise<string> {
    const newCourse: Course = {
      ...courseData,
      id: `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const courseId = await this.db.createRecord('courses', newCourse);
    
    await this.eventProcessor.publish('lms.course.created', { course: newCourse });
    
    return courseId;
  }

  async getCourse(courseId: string): Promise<Course | null> {
    return await this.db.findByField('courses', 'id', courseId);
  }

  async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    const updatedCourse = {
      ...updates,
      metadata: {
        ...updates.metadata,
        lastUpdated: new Date(),
        version: await this.incrementVersion(courseId)
      }
    };

    await this.db.updateRecord('courses', courseId, updatedCourse);
    await this.eventProcessor.publish('lms.course.updated', { courseId, updates });
  }

  async getCoursesByCategory(category: string): Promise<Course[]> {
    return await this.db.findByField('courses', 'category', category);
  }

  async searchCourses(query: string, filters?: any): Promise<Course[]> {
    const allCourses = await this.db.findAll('courses');
    
    return allCourses.filter(course => {
      // Text search
      const matchesText = course.title.toLowerCase().includes(query.toLowerCase()) ||
                         course.description.toLowerCase().includes(query.toLowerCase()) ||
                         course.metadata.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));

      // Apply filters
      if (filters) {
        if (filters.level && course.level !== filters.level) return false;
        if (filters.category && course.category !== filters.category) return false;
        if (filters.duration) {
          if (filters.duration.min && course.duration < filters.duration.min) return false;
          if (filters.duration.max && course.duration > filters.duration.max) return false;
        }
      }

      return matchesText;
    });
  }

  // Enrollment Management
  async enrollUser(userId: string, courseId: string, targetCompletionDate?: Date): Promise<string> {
    const existingEnrollment = await this.db.findByFields('enrollments', { userId, courseId });
    
    if (existingEnrollment) {
      throw new Error('User is already enrolled in this course');
    }

    const enrollment: Enrollment = {
      id: `enrollment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      courseId,
      enrollmentDate: new Date(),
      targetCompletionDate,
      status: 'enrolled',
      progress: {
        modulesCompleted: [],
        overallProgress: 0,
        timeSpent: 0,
        lastActivity: new Date()
      },
      performance: {
        averageScore: 0,
        assessmentScores: {},
        attempts: {}
      }
    };

    const enrollmentId = await this.db.createRecord('enrollments', enrollment);
    
    await this.eventProcessor.publish('lms.user.enrolled', { userId, courseId, enrollment });
    
    return enrollmentId;
  }

  async getUserEnrollments(userId: string): Promise<Enrollment[]> {
    return await this.db.findByField('enrollments', 'userId', userId);
  }

  async getEnrollment(userId: string, courseId: string): Promise<Enrollment | null> {
    return await this.db.findByFields('enrollments', { userId, courseId });
  }

  async updateEnrollmentProgress(userId: string, courseId: string, progress: Partial<Enrollment['progress']>): Promise<void> {
    const enrollment = await this.getEnrollment(userId, courseId);
    
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    const updatedProgress = {
      ...enrollment.progress,
      ...progress,
      lastActivity: new Date()
    };

    await this.db.updateRecord('enrollments', enrollment.id, {
      progress: updatedProgress,
      status: updatedProgress.overallProgress >= 100 ? 'completed' : 'active'
    });

    await this.eventProcessor.publish('lms.enrollment.progress', { userId, courseId, progress: updatedProgress });
  }

  // Learning Session Management
  async startLearningSession(userId: string, courseId: string, moduleId?: string): Promise<string> {
    const session: LearningSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      courseId,
      moduleId,
      startTime: new Date(),
      duration: 0,
      activities: [],
      completion: {
        completed: false,
        progress: 0
      }
    };

    const sessionId = await this.db.createRecord('learning_sessions', session);
    
    await this.eventProcessor.publish('lms.session.started', { session });
    
    return sessionId;
  }

  async trackSessionActivity(sessionId: string, activity: Omit<SessionActivity, 'timestamp'>): Promise<void> {
    const session = await this.db.findByField('learning_sessions', 'id', sessionId);
    
    if (!session) {
      throw new Error('Learning session not found');
    }

    const newActivity: SessionActivity = {
      ...activity,
      timestamp: new Date()
    };

    session.activities.push(newActivity);
    session.duration = new Date().getTime() - session.startTime.getTime();

    await this.db.updateRecord('learning_sessions', sessionId, {
      activities: session.activities,
      duration: session.duration
    });

    await this.eventProcessor.publish('lms.session.activity', { sessionId, activity: newActivity });
  }

  async completeLearningSession(sessionId: string, completion: { progress: number; score?: number }): Promise<void> {
    const session = await this.db.findByField('learning_sessions', 'id', sessionId);
    
    if (!session) {
      throw new Error('Learning session not found');
    }

    const updatedSession = {
      ...session,
      endTime: new Date(),
      duration: new Date().getTime() - session.startTime.getTime(),
      completion: {
        completed: true,
        ...completion
      }
    };

    await this.db.updateRecord('learning_sessions', sessionId, updatedSession);

    // Update enrollment progress
    await this.updateLearningProgress(session.userId, session.courseId, session.moduleId, completion);

    await this.eventProcessor.publish('lms.session.completed', { session: updatedSession });
  }

  private async updateLearningProgress(userId: string, courseId: string, moduleId?: string, completion?: any): Promise<void> {
    const enrollment = await this.getEnrollment(userId, courseId);
    const course = await this.getCourse(courseId);
    
    if (!enrollment || !course) return;

    // Update module completion
    if (moduleId && !enrollment.progress.modulesCompleted.includes(moduleId)) {
      enrollment.progress.modulesCompleted.push(moduleId);
    }

    // Calculate overall progress
    const totalModules = course.content.modules.length;
    const completedModules = enrollment.progress.modulesCompleted.length;
    const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

    await this.updateEnrollmentProgress(userId, courseId, {
      overallProgress: Math.min(overallProgress, 100),
      currentModule: moduleId
    });
  }

  // Assessment Management
  async submitAssessment(userId: string, assessmentId: string, answers: any): Promise<{ score: number; passed: boolean }> {
    const assessment = await this.db.findByField('assessments', 'id', assessmentId);
    
    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Grade the assessment
    const result = await this.gradeAssessment(assessment, answers);
    
    // Update enrollment performance
    const enrollment = await this.getEnrollment(userId, assessment.courseId);
    if (enrollment) {
      enrollment.performance.assessmentScores[assessmentId] = result.score;
      enrollment.performance.attempts[assessmentId] = (enrollment.performance.attempts[assessmentId] || 0) + 1;
      
      // Recalculate average score
      const scores = Object.values(enrollment.performance.assessmentScores);
      enrollment.performance.averageScore = scores.length > 0 
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
        : 0;

      await this.db.updateRecord('enrollments', enrollment.id, { performance: enrollment.performance });
    }

    await this.eventProcessor.publish('lms.assessment.submitted', { 
      userId, 
      assessmentId, 
      score: result.score, 
      passed: result.passed 
    });

    return result;
  }

  private async gradeAssessment(assessment: Assessment, answers: any): Promise<{ score: number; passed: boolean }> {
    let totalPoints = 0;
    let earnedPoints = 0;

    assessment.questions.forEach((question, index) => {
      totalPoints += question.points;
      
      const userAnswer = answers[question.id] || answers[index];
      if (this.isAnswerCorrect(question, userAnswer)) {
        earnedPoints += question.points;
      }
    });

    const score = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = score >= assessment.settings.passingScore;

    return { score: Math.round(score * 100) / 100, passed };
  }

  private isAnswerCorrect(question: Question, userAnswer: any): boolean {
    switch (question.type) {
      case 'multiple-choice':
        return question.correctAnswer === userAnswer;
      case 'true-false':
        return question.correctAnswer === userAnswer;
      case 'short-answer':
        return question.correctAnswer.toLowerCase() === userAnswer.toLowerCase().trim();
      case 'matching':
        // More complex logic for matching questions
        return JSON.stringify(question.correctAnswer) === JSON.stringify(userAnswer);
      default:
        return false;
    }
  }

  // Analytics and Reporting
  async getUserProgress(userId: string): Promise<any> {
    const enrollments = await this.getUserEnrollments(userId);
    const sessions = await this.db.findByField('learning_sessions', 'userId', userId);

    const totalCourses = enrollments.length;
    const completedCourses = enrollments.filter(e => e.status === 'completed').length;
    const inProgressCourses = enrollments.filter(e => e.status === 'active').length;
    const totalTimeSpent = sessions.reduce((sum, session) => sum + session.duration, 0);
    const averageScore = enrollments.length > 0 
      ? enrollments.reduce((sum, e) => sum + e.performance.averageScore, 0) / enrollments.length 
      : 0;

    return {
      totalCourses,
      completedCourses,
      inProgressCourses,
      completionRate: totalCourses > 0 ? (completedCourses / totalCourses) * 100 : 0,
      totalTimeSpent: Math.round(totalTimeSpent / 60000), // Convert to minutes
      averageScore: Math.round(averageScore * 100) / 100,
      currentStreak: await this.calculateLearningStreak(userId),
      weeklyGoalProgress: await this.getWeeklyGoalProgress(userId)
    };
  }

  async getUserRecentActivity(userId: string): Promise<any[]> {
    const sessions = await this.db.findByField('learning_sessions', 'userId', userId);
    
    return sessions
      .filter(session => session.endTime)
      .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())
      .slice(0, 10)
      .map(session => ({
        id: session.id,
        courseId: session.courseId,
        moduleId: session.moduleId,
        date: session.endTime,
        duration: Math.round(session.duration / 60000),
        progress: session.completion.progress,
        score: session.completion.score
      }));
  }

  async getPersonalizedRecommendations(userId: string): Promise<any[]> {
    const user = await this.getUser(userId);
    const enrollments = await this.getUserEnrollments(userId);
    
    if (!user) return [];

    // Get courses based on user's role, interests, and completion history
    const allCourses = await this.db.findAll('courses');
    const enrolledCourseIds = enrollments.map(e => e.courseId);
    
    const recommendations = allCourses
      .filter(course => !enrolledCourseIds.includes(course.id))
      .filter(course => course.settings.isPublished)
      .map(course => ({
        course,
        relevanceScore: this.calculateRelevanceScore(course, user, enrollments)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
      .map(rec => rec.course);

    return recommendations;
  }

  private calculateRelevanceScore(course: Course, user: LMSUser, enrollments: Enrollment[]): number {
    let score = 0;

    // Role relevance
    if (course.metadata.tags.includes(user.role)) score += 5;
    
    // Interest matching
    user.profile.interests.forEach(interest => {
      if (course.metadata.tags.includes(interest) || 
          course.title.toLowerCase().includes(interest.toLowerCase()) ||
          course.description.toLowerCase().includes(interest.toLowerCase())) {
        score += 3;
      }
    });

    // Level appropriateness
    const userLevel = this.determineUserLevel(enrollments);
    if (course.level === userLevel) score += 4;
    
    // Prerequisites met
    const completedCourses = enrollments
      .filter(e => e.status === 'completed')
      .map(e => e.courseId);
    
    const prerequisitesMet = course.prerequisites.every(prereq => 
      completedCourses.includes(prereq)
    );
    
    if (prerequisitesMet) score += 2;
    else if (course.prerequisites.length > 0) score -= 5;

    return score;
  }

  private determineUserLevel(enrollments: Enrollment[]): string {
    const completedCourses = enrollments.filter(e => e.status === 'completed').length;
    const averageScore = enrollments.length > 0 
      ? enrollments.reduce((sum, e) => sum + e.performance.averageScore, 0) / enrollments.length 
      : 0;

    if (completedCourses === 0) return 'beginner';
    if (completedCourses < 5 || averageScore < 70) return 'beginner';
    if (completedCourses < 15 || averageScore < 85) return 'intermediate';
    return 'advanced';
  }

  async getUserAchievements(userId: string): Promise<any[]> {
    const enrollments = await this.getUserEnrollments(userId);
    const sessions = await this.db.findByField('learning_sessions', 'userId', userId);
    
    const achievements = [];

    // Course completion achievements
    const completedCourses = enrollments.filter(e => e.status === 'completed');
    if (completedCourses.length >= 1) {
      achievements.push({ 
        type: 'first_completion', 
        title: 'First Course Completed', 
        date: completedCourses[0].actualCompletionDate 
      });
    }

    if (completedCourses.length >= 5) {
      achievements.push({ 
        type: 'course_milestone', 
        title: 'Course Enthusiast', 
        description: '5 courses completed',
        date: completedCourses[4].actualCompletionDate 
      });
    }

    // Performance achievements
    const highScoreCourses = enrollments.filter(e => e.performance.averageScore >= 90);
    if (highScoreCourses.length >= 1) {
      achievements.push({ 
        type: 'high_performer', 
        title: 'Excellence Award', 
        description: 'Scored 90% or higher',
        date: new Date() 
      });
    }

    // Learning streak achievements
    const currentStreak = await this.calculateLearningStreak(userId);
    if (currentStreak >= 7) {
      achievements.push({ 
        type: 'streak', 
        title: 'Learning Streak', 
        description: `${currentStreak} days in a row`,
        date: new Date() 
      });
    }

    return achievements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private async calculateLearningStreak(userId: string): Promise<number> {
    const sessions = await this.db.findByField('learning_sessions', 'userId', userId);
    
    const activityDates = sessions
      .filter(s => s.endTime)
      .map(s => s.endTime!.toDateString())
      .filter((date, index, arr) => arr.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 0;
    const today = new Date().toDateString();
    
    for (let i = 0; i < activityDates.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      
      if (activityDates[i] === expectedDate.toDateString()) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private async getWeeklyGoalProgress(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    const sessions = await this.db.findByField('learning_sessions', 'userId', userId);
    
    if (!user) return { completed: 0, target: 0, percentage: 0 };

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const thisWeekSessions = sessions.filter(s => 
      s.startTime >= weekStart && s.endTime
    );

    const totalMinutes = thisWeekSessions.reduce((sum, s) => sum + Math.round(s.duration / 60000), 0);
    const targetMinutes = (user.profile.availability.hoursPerWeek || 2) * 60;

    return {
      completed: totalMinutes,
      target: targetMinutes,
      percentage: targetMinutes > 0 ? Math.min((totalMinutes / targetMinutes) * 100, 100) : 0
    };
  }

  private async getUpcomingDeadlines(userId: string): Promise<any[]> {
    const enrollments = await this.getUserEnrollments(userId);
    
    return enrollments
      .filter(e => e.targetCompletionDate && e.status !== 'completed')
      .map(e => ({
        courseId: e.courseId,
        deadline: e.targetCompletionDate,
        progress: e.progress.overallProgress,
        daysRemaining: Math.ceil((e.targetCompletionDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }))
      .filter(d => d.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining);
  }

  // Utility Methods
  private async incrementVersion(courseId: string): Promise<string> {
    const course = await this.getCourse(courseId);
    if (!course) return '1.0.0';

    const [major, minor, patch] = course.metadata.version.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  // Event Handlers
  private async handleUserEnrolled(event: any): Promise<void> {
    const { userId, courseId } = event.data;
    
    // Send welcome message or notification
    await this.eventProcessor.publish('notification.send', {
      userId,
      type: 'course_enrollment',
      message: `Welcome to your new course! Start learning today.`,
      data: { courseId }
    });
  }

  private async handleSessionStarted(event: any): Promise<void> {
    const { session } = event.data;
    
    // Track session start in analytics
    await this.eventProcessor.publish('analytics.session.started', {
      userId: session.userId,
      courseId: session.courseId,
      timestamp: session.startTime
    });
  }

  private async handleSessionCompleted(event: any): Promise<void> {
    const { session } = event.data;
    
    // Award points, update streaks, send congratulations
    await this.eventProcessor.publish('gamification.session.completed', {
      userId: session.userId,
      points: Math.ceil(session.duration / 60000), // 1 point per minute
      duration: session.duration
    });
  }

  private async handleAssessmentSubmitted(event: any): Promise<void> {
    const { userId, assessmentId, score, passed } = event.data;
    
    if (passed) {
      await this.eventProcessor.publish('notification.send', {
        userId,
        type: 'assessment_passed',
        message: `Congratulations! You passed with a score of ${score}%`,
        data: { assessmentId, score }
      });
    } else {
      await this.eventProcessor.publish('notification.send', {
        userId,
        type: 'assessment_failed',
        message: `You scored ${score}%. Review the material and try again.`,
        data: { assessmentId, score }
      });
    }
  }
}

export default LearningManagementService;