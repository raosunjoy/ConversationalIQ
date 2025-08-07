/**
 * Learning Management Dashboard
 * Main dashboard for training programs, courses, and learning progress
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@zendeskgarden/react-buttons';
import { Badge } from '@zendeskgarden/react-badges';
import { Alert } from '@zendeskgarden/react-notifications';
import { Field, Input, Label, Select } from '@zendeskgarden/react-forms';
import { Tabs, TabList, Tab, TabPanel } from '@zendeskgarden/react-tabs';
import { Progress } from '@zendeskgarden/react-loaders';

interface UserProgress {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  completionRate: number;
  totalTimeSpent: number;
  averageScore: number;
  currentStreak: number;
  weeklyGoalProgress: {
    completed: number;
    target: number;
    percentage: number;
  };
}

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number;
  format: string;
  rating: number;
  enrollments: number;
}

interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  status: 'enrolled' | 'active' | 'completed' | 'dropped' | 'paused';
  progress: {
    overallProgress: number;
    timeSpent: number;
    lastActivity: Date;
  };
  performance: {
    averageScore: number;
    assessmentScores: { [key: string]: number };
  };
  targetCompletionDate?: Date;
}

interface Achievement {
  type: string;
  title: string;
  description?: string;
  date: Date;
  icon?: string;
}

interface LearningManagementDashboardProps {
  userId: string;
  role: 'learner' | 'instructor' | 'admin';
  onNavigate?: (path: string) => void;
}

const LearningManagementDashboard: React.FC<LearningManagementDashboardProps> = ({
  userId,
  role,
  onNavigate
}) => {
  const [selectedTab, setSelectedTab] = useState('dashboard');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [recommendations, setRecommendations] = useState<Course[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Simulate API calls
      const dashboardData = await fetchUserDashboard(userId);
      
      setUserProgress(dashboardData.progress);
      setEnrollments(dashboardData.enrollments);
      setRecommendations(dashboardData.recommendations);
      setAchievements(dashboardData.achievements);
      setRecentActivity(dashboardData.recentActivity);
      setUpcomingDeadlines(dashboardData.upcomingDeadlines);
      
      // Load available courses
      const courses = await fetchAvailableCourses();
      setAvailableCourses(courses);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDashboard = async (userId: string): Promise<any> => {
    // Simulate API call
    return {
      progress: {
        totalCourses: 8,
        completedCourses: 5,
        inProgressCourses: 2,
        completionRate: 62.5,
        totalTimeSpent: 450, // minutes
        averageScore: 87.5,
        currentStreak: 12,
        weeklyGoalProgress: {
          completed: 180,
          target: 300,
          percentage: 60
        }
      },
      enrollments: [
        {
          id: 'enroll_1',
          courseId: 'course_1',
          courseTitle: 'Advanced ConversationIQ Analytics',
          status: 'active',
          progress: {
            overallProgress: 65,
            timeSpent: 180,
            lastActivity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
          },
          performance: {
            averageScore: 92,
            assessmentScores: { 'quiz_1': 90, 'quiz_2': 94 }
          },
          targetCompletionDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'enroll_2',
          courseId: 'course_2',
          courseTitle: 'Customer Service Excellence',
          status: 'completed',
          progress: {
            overallProgress: 100,
            timeSpent: 240,
            lastActivity: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
          },
          performance: {
            averageScore: 88,
            assessmentScores: { 'final_exam': 88 }
          }
        }
      ],
      recommendations: [
        {
          id: 'course_3',
          title: 'AI-Powered Customer Insights',
          description: 'Learn to leverage AI for deeper customer understanding',
          category: 'Analytics',
          level: 'advanced',
          duration: 120,
          format: 'mixed',
          rating: 4.8,
          enrollments: 234
        }
      ],
      achievements: [
        {
          type: 'streak',
          title: 'Learning Streak Champion',
          description: '12 days in a row',
          date: new Date(),
          icon: '🔥'
        },
        {
          type: 'high_performer',
          title: 'Excellence Award',
          description: 'Scored 90% or higher',
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          icon: '⭐'
        }
      ],
      recentActivity: [
        {
          id: 'activity_1',
          courseId: 'course_1',
          courseTitle: 'Advanced ConversationIQ Analytics',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          duration: 45,
          progress: 15,
          score: 94
        }
      ],
      upcomingDeadlines: [
        {
          courseId: 'course_1',
          courseTitle: 'Advanced ConversationIQ Analytics',
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          progress: 65,
          daysRemaining: 14
        }
      ]
    };
  };

  const fetchAvailableCourses = async (): Promise<Course[]> => {
    // Simulate API call
    return [
      {
        id: 'course_1',
        title: 'ConversationIQ Fundamentals',
        description: 'Master the basics of conversation intelligence',
        category: 'Foundation',
        level: 'beginner',
        duration: 180,
        format: 'mixed',
        rating: 4.6,
        enrollments: 1234
      },
      {
        id: 'course_2',
        title: 'Advanced Sentiment Analysis',
        description: 'Deep dive into sentiment analysis and interpretation',
        category: 'Analytics',
        level: 'advanced',
        duration: 240,
        format: 'interactive',
        rating: 4.8,
        enrollments: 567
      }
    ];
  };

  const handleEnrollInCourse = async (courseId: string): Promise<void> => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh dashboard data
      await loadDashboardData();
      
      alert('Successfully enrolled in course!');
    } catch (error) {
      console.error('Failed to enroll in course:', error);
      alert('Failed to enroll in course. Please try again.');
    }
  };

  const handleStartCourse = (courseId: string): void => {
    if (onNavigate) {
      onNavigate(`/learning/course/${courseId}`);
    }
  };

  const filteredCourses = availableCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || course.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getStatusBadgeType = (status: string): 'positive' | 'warning' | 'neutral' | 'danger' => {
    switch (status) {
      case 'completed': return 'positive';
      case 'active': return 'warning';
      case 'paused': return 'neutral';
      case 'dropped': return 'danger';
      default: return 'neutral';
    }
  };

  const getLevelBadgeType = (level: string): 'positive' | 'warning' | 'danger' => {
    switch (level) {
      case 'beginner': return 'positive';
      case 'intermediate': return 'warning';
      case 'advanced': return 'danger';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <Progress size="large" />
          <p className="mt-4 text-gray-600">Loading your learning dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Learning Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your progress and continue learning</p>
        </div>
        <div className="flex space-x-3">
          <Button isPrimary onClick={() => onNavigate?.('/learning/catalog')}>
            Browse Catalog
          </Button>
        </div>
      </div>

      {/* Progress Overview Cards */}
      {userProgress && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{userProgress.completionRate}%</p>
              </div>
              <div className="text-blue-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={userProgress.completionRate} />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Learning Streak</p>
                <p className="text-2xl font-bold text-gray-900">{userProgress.currentStreak} days</p>
              </div>
              <div className="text-orange-500">
                <span className="text-2xl">🔥</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Keep it up!</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">{userProgress.averageScore}%</p>
              </div>
              <div className="text-green-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Excellent performance!</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Weekly Goal</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userProgress.weeklyGoalProgress.completed}m / {userProgress.weeklyGoalProgress.target}m
                </p>
              </div>
              <div className="text-purple-500">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="mt-4">
              <Progress value={userProgress.weeklyGoalProgress.percentage} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs selectedItem={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <Tab item="dashboard">Dashboard</Tab>
          <Tab item="my-courses">My Courses</Tab>
          <Tab item="catalog">Course Catalog</Tab>
          <Tab item="achievements">Achievements</Tab>
        </TabList>

        <TabPanel item="dashboard">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Continue Learning */}
            <div className="lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Continue Learning</h3>
              <div className="space-y-4">
                {enrollments
                  .filter(e => e.status === 'active')
                  .map(enrollment => (
                    <div key={enrollment.id} className="bg-white p-6 rounded-lg shadow border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{enrollment.courseTitle}</h4>
                          <div className="flex items-center space-x-4 mt-2">
                            <Badge type={getStatusBadgeType(enrollment.status)}>
                              {enrollment.status}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {enrollment.progress.overallProgress}% complete
                            </span>
                            <span className="text-sm text-gray-600">
                              {Math.round(enrollment.progress.timeSpent / 60)}h spent
                            </span>
                          </div>
                          <div className="mt-3">
                            <Progress value={enrollment.progress.overallProgress} />
                          </div>
                        </div>
                        <div className="ml-4">
                          <Button size="small" onClick={() => handleStartCourse(enrollment.courseId)}>
                            Continue
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Recent Activity */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                <div className="bg-white rounded-lg shadow border">
                  <div className="divide-y">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{activity.courseTitle}</p>
                          <p className="text-sm text-gray-600">
                            {activity.duration} minutes • {activity.score && `Score: ${activity.score}%`}
                          </p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(activity.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Deadlines */}
              {upcomingDeadlines.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Upcoming Deadlines</h3>
                  <div className="bg-white rounded-lg shadow border">
                    <div className="divide-y">
                      {upcomingDeadlines.map((deadline, index) => (
                        <div key={index} className="p-4">
                          <p className="font-medium text-gray-900">{deadline.courseTitle}</p>
                          <p className="text-sm text-gray-600">
                            Due in {deadline.daysRemaining} days
                          </p>
                          <div className="mt-2">
                            <Progress value={deadline.progress} size="small" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Recommended for You</h3>
                <div className="space-y-4">
                  {recommendations.map(course => (
                    <div key={course.id} className="bg-white p-4 rounded-lg shadow border">
                      <h4 className="font-medium text-gray-900 mb-2">{course.title}</h4>
                      <p className="text-sm text-gray-600 mb-3">{course.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge type={getLevelBadgeType(course.level)} size="small">
                            {course.level}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {Math.round(course.duration / 60)}h
                          </span>
                        </div>
                        <Button 
                          size="small" 
                          onClick={() => handleEnrollInCourse(course.id)}
                        >
                          Enroll
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <TabPanel item="my-courses">
          <div>
            <h3 className="text-lg font-semibold mb-6">My Courses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map(enrollment => (
                <div key={enrollment.id} className="bg-white p-6 rounded-lg shadow border">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-gray-900">{enrollment.courseTitle}</h4>
                    <Badge type={getStatusBadgeType(enrollment.status)}>
                      {enrollment.status}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{enrollment.progress.overallProgress}%</span>
                      </div>
                      <Progress value={enrollment.progress.overallProgress} />
                    </div>
                    
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Time Spent:</span>
                      <span>{Math.round(enrollment.progress.timeSpent / 60)}h</span>
                    </div>
                    
                    {enrollment.performance.averageScore > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Average Score:</span>
                        <span>{enrollment.performance.averageScore}%</span>
                      </div>
                    )}
                    
                    {enrollment.targetCompletionDate && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Target Date:</span>
                        <span>{new Date(enrollment.targetCompletionDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6">
                    <Button 
                      size="small" 
                      onClick={() => handleStartCourse(enrollment.courseId)}
                      disabled={enrollment.status === 'completed'}
                    >
                      {enrollment.status === 'completed' ? 'Completed' : 'Continue'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabPanel>

        <TabPanel item="catalog">
          <div>
            {/* Search and Filters */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Field>
                  <Label>Search Courses</Label>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or description..."
                  />
                </Field>
              </div>
              <div className="sm:w-48">
                <Field>
                  <Label>Category</Label>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Analytics">Analytics</option>
                    <option value="Advanced">Advanced</option>
                  </Select>
                </Field>
              </div>
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map(course => (
                <div key={course.id} className="bg-white p-6 rounded-lg shadow border hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-semibold text-gray-900">{course.title}</h4>
                    <Badge type={getLevelBadgeType(course.level)}>
                      {course.level}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">{course.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">⭐ {course.rating}</span>
                      <span className="text-sm text-gray-600">•</span>
                      <span className="text-sm text-gray-600">{course.enrollments} enrolled</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {Math.round(course.duration / 60)}h
                    </span>
                  </div>
                  
                  <Button 
                    isPrimary
                    onClick={() => handleEnrollInCourse(course.id)}
                  >
                    Enroll Now
                  </Button>
                </div>
              ))}
            </div>
            
            {filteredCourses.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No courses found matching your criteria.</p>
                <Button onClick={() => { setSearchQuery(''); setFilterCategory('all'); }} className="mt-4">
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </TabPanel>

        <TabPanel item="achievements">
          <div>
            <h3 className="text-lg font-semibold mb-6">Your Achievements</h3>
            
            {achievements.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievements.map((achievement, index) => (
                  <div key={index} className="bg-white p-6 rounded-lg shadow border text-center">
                    <div className="text-4xl mb-3">{achievement.icon}</div>
                    <h4 className="font-semibold text-gray-900 mb-2">{achievement.title}</h4>
                    {achievement.description && (
                      <p className="text-sm text-gray-600 mb-3">{achievement.description}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Earned {new Date(achievement.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-gray-600">No achievements yet.</p>
                <p className="text-sm text-gray-500 mt-2">Complete courses and maintain learning streaks to earn achievements!</p>
              </div>
            )}
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default LearningManagementDashboard;