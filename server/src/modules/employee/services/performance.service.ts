import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EmployeeRepository } from '../repositories/employee.repository';
import { 
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  CreateEmployeeGoalDto,
  UpdateEmployeeGoalDto,
  CreateTrainingRecordDto,
  UpdateTrainingRecordDto,
  EmploymentStatus,
} from '../dto/employee.dto';
import { PerformanceReview, EmployeeGoal, TrainingRecord } from '../entities/employee.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Performance Review Management
  async createPerformanceReview(tenantId: string, data: CreatePerformanceReviewDto, createdBy: string): Promise<PerformanceReview> {
    // Verify employee and reviewer exist
    await this.employeeRepository.findEmployeeById(tenantId, data.employeeId);
    await this.employeeRepository.findEmployeeById(tenantId, data.reviewerId);

    // Validate review period
    const startDate = new Date(data.reviewPeriodStart);
    const endDate = new Date(data.reviewPeriodEnd);

    if (startDate >= endDate) {
      throw new BadRequestException('Review period start date must be before end date');
    }

    // Check for overlapping reviews
    const existingReviews = await this.employeeRepository.findPerformanceReviewsByEmployee(tenantId, data.employeeId);
    const hasOverlap = existingReviews.some(review => {
      const existingStart = new Date(review.reviewPeriodStart);
      const existingEnd = new Date(review.reviewPeriodEnd);
      
      return (startDate < existingEnd && endDate > existingStart);
    });

    if (hasOverlap) {
      throw new BadRequestException('Performance review period overlaps with existing review');
    }

    const review = await this.employeeRepository.createPerformanceReview(tenantId, data, createdBy);

    // Emit event for performance review creation
    this.eventEmitter.emit('performance.review.created', {
      tenantId,
      employeeId: data.employeeId,
      reviewId: review.id,
      review,
      createdBy,
    });

    return review;
  }

  async updatePerformanceReview(tenantId: string, id: string, data: UpdatePerformanceReviewDto, updatedBy: string): Promise<PerformanceReview> {
    const review = await this.employeeRepository.updatePerformanceReview(tenantId, id, data, updatedBy);

    // Emit event for performance review update
    this.eventEmitter.emit('performance.review.updated', {
      tenantId,
      reviewId: id,
      review,
      updatedBy,
      changes: data,
    });

    return review;
  }

  async completePerformanceReview(tenantId: string, id: string, completedBy: string): Promise<PerformanceReview> {
    const updateData: UpdatePerformanceReviewDto = {
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    const review = await this.employeeRepository.updatePerformanceReview(tenantId, id, updateData, completedBy);

    // Emit event for performance review completion
    this.eventEmitter.emit('performance.review.completed', {
      tenantId,
      reviewId: id,
      review,
      completedBy,
    });

    return review;
  }

  async acknowledgePerformanceReview(tenantId: string, id: string, acknowledgedBy: string): Promise<PerformanceReview> {
    const updateData: UpdatePerformanceReviewDto = {
      acknowledgedAt: new Date().toISOString(),
    };

    const review = await this.employeeRepository.updatePerformanceReview(tenantId, id, updateData, acknowledgedBy);

    // Emit event for performance review acknowledgment
    this.eventEmitter.emit('performance.review.acknowledged', {
      tenantId,
      reviewId: id,
      review,
      acknowledgedBy,
    });

    return review;
  }

  // Goal Management
  async createEmployeeGoal(tenantId: string, data: CreateEmployeeGoalDto, createdBy: string): Promise<EmployeeGoal> {
    // Verify employee exists
    await this.employeeRepository.findEmployeeById(tenantId, data.employeeId);

    // Validate goal dates
    const startDate = new Date(data.startDate);
    const targetDate = new Date(data.targetDate);

    if (startDate >= targetDate) {
      throw new BadRequestException('Goal start date must be before target date');
    }

    const goal = await this.employeeRepository.createEmployeeGoal(tenantId, data, createdBy);

    // Emit event for goal creation
    this.eventEmitter.emit('employee.goal.created', {
      tenantId,
      employeeId: data.employeeId,
      goalId: goal.id,
      goal,
      createdBy,
    });

    return goal;
  }

  async updateEmployeeGoal(tenantId: string, id: string, data: UpdateEmployeeGoalDto, updatedBy: string): Promise<EmployeeGoal> {
    const goal = await this.employeeRepository.updateEmployeeGoal(tenantId, id, data, updatedBy);

    // Emit event for goal update
    this.eventEmitter.emit('employee.goal.updated', {
      tenantId,
      goalId: id,
      goal,
      updatedBy,
      changes: data,
    });

    return goal;
  }

  async updateGoalProgress(tenantId: string, goalId: string, progress: number, updatedBy: string, notes?: string): Promise<EmployeeGoal> {
    if (progress < 0 || progress > 100) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }

    const updateData: UpdateEmployeeGoalDto = {
      progress,
      lastReviewDate: new Date().toISOString(),
    };

    if (progress === 100) {
      updateData.status = 'completed';
      updateData.completedDate = new Date().toISOString();
    }

    if (notes) {
      // Add progress update to the updates array
      const goal = await this.employeeRepository.findGoalById(tenantId, goalId);
      if (goal) {
        const updates = goal.updates || [];
        updates.push({
          date: new Date().toISOString(),
          progress,
          notes,
          updatedBy,
        });
        updateData.updates = updates;
      }
    }

    const updatedGoal = await this.employeeRepository.updateEmployeeGoal(tenantId, goalId, updateData, updatedBy);

    // Emit event for goal progress update
    this.eventEmitter.emit('employee.goal.progress.updated', {
      tenantId,
      goalId,
      goal: updatedGoal,
      progress,
      updatedBy,
    });

    return updatedGoal;
  }

  async completeEmployeeGoal(tenantId: string, goalId: string, completedBy: string): Promise<EmployeeGoal> {
    const updateData: UpdateEmployeeGoalDto = {
      status: 'completed',
      progress: 100,
      completedDate: new Date().toISOString(),
    };

    const goal = await this.employeeRepository.updateEmployeeGoal(tenantId, goalId, updateData, completedBy);

    // Emit event for goal completion
    this.eventEmitter.emit('employee.goal.completed', {
      tenantId,
      goalId,
      goal,
      completedBy,
    });

    return goal;
  }

  // Training Management
  async createTrainingRecord(tenantId: string, data: CreateTrainingRecordDto, createdBy: string): Promise<TrainingRecord> {
    // Verify employee exists
    await this.employeeRepository.findEmployeeById(tenantId, data.employeeId);

    // Validate training dates
    if (data.startDate && data.completionDate) {
      const startDate = new Date(data.startDate);
      const completionDate = new Date(data.completionDate);

      if (startDate > completionDate) {
        throw new BadRequestException('Training start date must be before completion date');
      }
    }

    const training = await this.employeeRepository.createTrainingRecord(tenantId, data, createdBy);

    // Emit event for training record creation
    this.eventEmitter.emit('employee.training.created', {
      tenantId,
      employeeId: data.employeeId,
      trainingId: training.id,
      training,
      createdBy,
    });

    return training;
  }

  async updateTrainingRecord(tenantId: string, id: string, data: UpdateTrainingRecordDto, updatedBy: string): Promise<TrainingRecord> {
    const training = await this.employeeRepository.updateTrainingRecord(tenantId, id, data, updatedBy);

    // Emit event for training record update
    this.eventEmitter.emit('employee.training.updated', {
      tenantId,
      trainingId: id,
      training,
      updatedBy,
      changes: data,
    });

    return training;
  }

  async completeTraining(tenantId: string, trainingId: string, completionData: { completionDate: string; score?: number; certificateNumber?: string }, completedBy: string): Promise<TrainingRecord> {
    const updateData: UpdateTrainingRecordDto = {
      ...completionData,
      status: 'completed',
    };

    const training = await this.employeeRepository.updateTrainingRecord(tenantId, trainingId, updateData, completedBy);

    // Emit event for training completion
    this.eventEmitter.emit('employee.training.completed', {
      tenantId,
      trainingId,
      training,
      completedBy,
    });

    return training;
  }

  // Performance Analytics
  async getEmployeePerformanceAnalytics(tenantId: string, employeeId: string, startDate: Date, endDate: Date): Promise<any> {
    // Verify employee exists
    await this.employeeRepository.findEmployeeById(tenantId, employeeId);

    // Get performance reviews in the period
    const reviews = await this.employeeRepository.findPerformanceReviewsByEmployee(tenantId, employeeId);
    const periodReviews = reviews.filter(review => {
      const reviewEnd = new Date(review.reviewPeriodEnd);
      return reviewEnd >= startDate && reviewEnd <= endDate;
    });

    // Get goals in the period
    const goals = await this.employeeRepository.findGoalsByEmployee(tenantId, employeeId);
    const periodGoals = goals.filter(goal => {
      const goalStart = new Date(goal.startDate);
      const goalTarget = new Date(goal.targetDate);
      return (goalStart <= endDate && goalTarget >= startDate);
    });

    // Get training records in the period
    const trainings = await this.employeeRepository.findTrainingRecordsByEmployee(tenantId, employeeId);
    const periodTrainings = trainings.filter(training => {
      if (training.completionDate) {
        const completionDate = new Date(training.completionDate);
        return completionDate >= startDate && completionDate <= endDate;
      }
      return false;
    });

    // Calculate analytics
    const analytics = {
      employeeId,
      period: { startDate, endDate },
      performanceReviews: {
        total: periodReviews.length,
        averageRating: this.calculateAverageRating(periodReviews),
        ratingTrend: this.calculateRatingTrend(periodReviews),
        completedReviews: periodReviews.filter(r => r.status === 'completed').length,
      },
      goals: {
        total: periodGoals.length,
        completed: periodGoals.filter(g => g.status === 'completed').length,
        inProgress: periodGoals.filter(g => g.status === 'active').length,
        overdue: periodGoals.filter(g => this.isGoalOverdue(g)).length,
        averageProgress: this.calculateAverageGoalProgress(periodGoals),
        completionRate: periodGoals.length > 0 ? (periodGoals.filter(g => g.status === 'completed').length / periodGoals.length) * 100 : 0,
      },
      training: {
        total: periodTrainings.length,
        completed: periodTrainings.filter(t => t.status === 'completed').length,
        averageScore: this.calculateAverageTrainingScore(periodTrainings),
        totalHours: periodTrainings.reduce((sum, t) => sum + (t.duration || 0), 0),
        certifications: periodTrainings.filter(t => t.certificateNumber).length,
      },
    };

    return analytics;
  }

  async getDepartmentPerformanceAnalytics(tenantId: string, department: string, startDate: Date, endDate: Date): Promise<any> {
    // Get all employees in the department
    const employees = await this.employeeRepository.findEmployees(tenantId, {
      department,
      employmentStatus: EmploymentStatus.ACTIVE,
      page: 1,
      limit: 1000,
    });

    const departmentAnalytics = {
      department,
      period: { startDate, endDate },
      employeeCount: employees.employees.length,
      performanceMetrics: {
        averageRating: 0,
        reviewCompletionRate: 0,
        goalCompletionRate: 0,
        trainingCompletionRate: 0,
      },
      topPerformers: [],
      improvementAreas: [],
    };

    // Calculate metrics for each employee and aggregate
    let totalRating = 0;
    let totalReviews = 0;
    let totalGoals = 0;
    let completedGoals = 0;
    let totalTrainings = 0;
    let completedTrainings = 0;

    for (const employee of employees.employees) {
      const employeeAnalytics = await this.getEmployeePerformanceAnalytics(
        tenantId,
        employee.id,
        startDate,
        endDate
      );

      if (employeeAnalytics.performanceReviews.averageRating > 0) {
        totalRating += employeeAnalytics.performanceReviews.averageRating;
        totalReviews++;
      }

      totalGoals += employeeAnalytics.goals.total;
      completedGoals += employeeAnalytics.goals.completed;

      totalTrainings += employeeAnalytics.training.total;
      completedTrainings += employeeAnalytics.training.completed;
    }

    // Calculate department averages
    departmentAnalytics.performanceMetrics = {
      averageRating: totalReviews > 0 ? totalRating / totalReviews : 0,
      reviewCompletionRate: employees.employees.length > 0 ? (totalReviews / employees.employees.length) * 100 : 0,
      goalCompletionRate: totalGoals > 0 ? (completedGoals / totalGoals) * 100 : 0,
      trainingCompletionRate: totalTrainings > 0 ? (completedTrainings / totalTrainings) * 100 : 0,
    };

    return departmentAnalytics;
  }

  // Helper methods
  private calculateAverageRating(reviews: PerformanceReview[]): number {
    const ratedReviews = reviews.filter(r => r.overallRating);
    if (ratedReviews.length === 0) return 0;

    const ratingValues = {
      'outstanding': 5,
      'exceeds_expectations': 4,
      'meets_expectations': 3,
      'below_expectations': 2,
      'unsatisfactory': 1,
    };

    const totalRating = ratedReviews.reduce((sum, review) => {
      return sum + (ratingValues[review.overallRating as keyof typeof ratingValues] || 0);
    }, 0);

    return totalRating / ratedReviews.length;
  }

  private calculateRatingTrend(reviews: PerformanceReview[]): string {
    if (reviews.length < 2) return 'insufficient_data';

    const sortedReviews = reviews
      .filter(r => r.overallRating)
      .sort((a, b) => new Date(a.reviewPeriodEnd).getTime() - new Date(b.reviewPeriodEnd).getTime());

    if (sortedReviews.length < 2) return 'insufficient_data';

    const ratingValues = {
      'outstanding': 5,
      'exceeds_expectations': 4,
      'meets_expectations': 3,
      'below_expectations': 2,
      'unsatisfactory': 1,
    };

    const firstReview = sortedReviews[0];
    const lastReview = sortedReviews[sortedReviews.length - 1];

    if (!firstReview || !lastReview || !firstReview.overallRating || !lastReview.overallRating) {
      return 'insufficient_data';
    }

    const firstRating = ratingValues[firstReview.overallRating as keyof typeof ratingValues];
    const lastRating = ratingValues[lastReview.overallRating as keyof typeof ratingValues];

    if (lastRating > firstRating) return 'improving';
    if (lastRating < firstRating) return 'declining';
    return 'stable';
  }

  private calculateAverageGoalProgress(goals: EmployeeGoal[]): number {
    if (goals.length === 0) return 0;

    const totalProgress = goals.reduce((sum, goal) => sum + (goal.progress || 0), 0);
    return totalProgress / goals.length;
  }

  private isGoalOverdue(goal: EmployeeGoal): boolean {
    if (goal.status === 'completed') return false;
    
    const targetDate = new Date(goal.targetDate);
    const now = new Date();
    
    return targetDate < now;
  }

  private calculateAverageTrainingScore(trainings: TrainingRecord[]): number {
    const scoredTrainings = trainings.filter(t => t.score !== undefined && t.score !== null);
    if (scoredTrainings.length === 0) return 0;

    const totalScore = scoredTrainings.reduce((sum, training) => sum + (training.score || 0), 0);
    return totalScore / scoredTrainings.length;
  }

  // Performance improvement recommendations
  async getPerformanceRecommendations(tenantId: string, employeeId: string): Promise<any> {
    const employee = await this.employeeRepository.findEmployeeById(tenantId, employeeId);
    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 1); // Last 12 months

    const analytics = await this.getEmployeePerformanceAnalytics(tenantId, employeeId, startDate, endDate);

    const recommendations = [];

    // Performance review recommendations
    if (analytics.performanceReviews.averageRating < 3) {
      recommendations.push({
        type: 'performance_improvement',
        priority: 'high',
        title: 'Performance Improvement Plan',
        description: 'Consider creating a performance improvement plan with specific goals and regular check-ins.',
        actions: [
          'Schedule weekly one-on-one meetings',
          'Set specific, measurable goals',
          'Provide additional training or mentoring',
        ],
      });
    }

    // Goal completion recommendations
    if (analytics.goals.completionRate < 70) {
      recommendations.push({
        type: 'goal_management',
        priority: 'medium',
        title: 'Goal Setting and Tracking',
        description: 'Improve goal completion rate through better goal setting and tracking.',
        actions: [
          'Review and adjust goal difficulty',
          'Provide more frequent progress check-ins',
          'Ensure goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound)',
        ],
      });
    }

    // Training recommendations
    if (analytics.training.completed < 2) {
      recommendations.push({
        type: 'training_development',
        priority: 'medium',
        title: 'Professional Development',
        description: 'Increase training and development opportunities to enhance skills.',
        actions: [
          'Identify skill gaps through assessment',
          'Enroll in relevant training programs',
          'Consider mentoring or coaching opportunities',
        ],
      });
    }

    return {
      employeeId,
      employee: {
        name: `${employee.firstName} ${employee.lastName}`,
        position: employee.position,
        department: employee.department,
      },
      analytics,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }
}