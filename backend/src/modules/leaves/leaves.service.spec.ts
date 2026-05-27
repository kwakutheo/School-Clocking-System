import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeaveRequest } from './leave-request.entity';
import { Employee } from '../employees/employee.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeaveStatus } from '../../common/enums';
import { User } from '../users/user.entity';

describe('LeavesService', () => {
  let service: LeavesService;

  const mockLeaveRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
  };

  const mockEmployeeRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const mockNotificationsService = {
    sendSilentSyncToToken: jest.fn().mockResolvedValue(true),
    sendPushToToken: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeavesService,
        { provide: getRepositoryToken(LeaveRequest), useValue: mockLeaveRepo },
        { provide: getRepositoryToken(Employee), useValue: mockEmployeeRepo },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<LeavesService>(LeavesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── reviewLeave ────────────────────────────────────────────────────────────

  describe('reviewLeave', () => {
    const reviewerId = 'reviewer-uuid';
    const leaveId = 'leave-uuid';
    const reviewer = { id: reviewerId } as User;

    const buildLeave = (token?: string): LeaveRequest => {
      const emp = new Employee();
      const user = new User();
      user.fcmToken = token ?? null;
      (emp as any).user = user;

      const leave = new LeaveRequest();
      leave.id = leaveId;
      leave.status = LeaveStatus.PENDING;
      (leave as any).employee = emp;
      return leave;
    };

    it('should approve a PENDING leave request and save it', async () => {
      const leave = buildLeave();
      mockLeaveRepo.findOne.mockResolvedValue(leave);
      mockLeaveRepo.save.mockResolvedValue({ ...leave, status: LeaveStatus.APPROVED });

      const result = await service.reviewLeave(leaveId, reviewer, {
        status: LeaveStatus.APPROVED,
        reviewNote: 'Approved!',
      });

      expect(mockLeaveRepo.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(LeaveStatus.APPROVED);
    });

    it('should reject a PENDING leave request and save it', async () => {
      const leave = buildLeave();
      mockLeaveRepo.findOne.mockResolvedValue(leave);
      mockLeaveRepo.save.mockResolvedValue({ ...leave, status: LeaveStatus.REJECTED });

      const result = await service.reviewLeave(leaveId, reviewer, {
        status: LeaveStatus.REJECTED,
      });

      expect(result.status).toBe(LeaveStatus.REJECTED);
    });

    it('should throw ForbiddenException if leave is not PENDING', async () => {
      const leave = buildLeave();
      leave.status = LeaveStatus.APPROVED; // Already processed
      mockLeaveRepo.findOne.mockResolvedValue(leave);

      await expect(
        service.reviewLeave(leaveId, reviewer, { status: LeaveStatus.REJECTED }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if leave does not exist', async () => {
      mockLeaveRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reviewLeave('non-existent-id', reviewer, { status: LeaveStatus.APPROVED }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should send silent sync + push notification if employee has FCM token', async () => {
      const leave = buildLeave('valid-fcm-token');
      mockLeaveRepo.findOne.mockResolvedValue(leave);
      mockLeaveRepo.save.mockResolvedValue({ ...leave, status: LeaveStatus.APPROVED });

      await service.reviewLeave(leaveId, reviewer, { status: LeaveStatus.APPROVED });

      expect(mockNotificationsService.sendSilentSyncToToken).toHaveBeenCalledWith(
        'valid-fcm-token',
        'refresh_dashboard',
      );
      expect(mockNotificationsService.sendPushToToken).toHaveBeenCalledWith(
        'valid-fcm-token',
        'Leave Request Update',
        expect.stringContaining('approved'),
      );
    });

    it('should NOT send notifications if employee has no FCM token', async () => {
      const leave = buildLeave(undefined); // No token
      mockLeaveRepo.findOne.mockResolvedValue(leave);
      mockLeaveRepo.save.mockResolvedValue({ ...leave, status: LeaveStatus.APPROVED });

      await service.reviewLeave(leaveId, reviewer, { status: LeaveStatus.APPROVED });

      expect(mockNotificationsService.sendSilentSyncToToken).not.toHaveBeenCalled();
      expect(mockNotificationsService.sendPushToToken).not.toHaveBeenCalled();
    });

    it('should always log an audit entry regardless of FCM token', async () => {
      const leave = buildLeave();
      mockLeaveRepo.findOne.mockResolvedValue(leave);
      mockLeaveRepo.save.mockResolvedValue({ ...leave, status: LeaveStatus.APPROVED });

      await service.reviewLeave(leaveId, reviewer, { status: LeaveStatus.APPROVED });

      expect(mockAuditService.log).toHaveBeenCalledTimes(1);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: `LEAVE_${LeaveStatus.APPROVED}`,
          module: 'LEAVES',
        }),
      );
    });
  });

  // ── requestLeave ───────────────────────────────────────────────────────────

  describe('requestLeave', () => {
    const userId = 'user-uuid';
    const empId  = 'emp-uuid';

    const mockEmployee = { id: empId, user: { id: userId } };

    const buildQb = (overlapResult: any = null) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(overlapResult),
    });

    beforeEach(() => {
      // Employee repo: always resolves the mock employee
      mockEmployeeRepo.createQueryBuilder.mockReturnValue(buildQb(mockEmployee));
    });

    it('should throw BadRequestException when endDate is before startDate', async () => {
      await expect(
        service.requestLeave(userId, {
          leaveType: 'ANNUAL',
          startDate: '2099-06-10',
          endDate: '2099-06-05', // end before start
        }),
      ).rejects.toThrow('end date cannot be before the start date');
    });

    it('should throw BadRequestException for invalid date format', async () => {
      await expect(
        service.requestLeave(userId, {
          leaveType: 'ANNUAL',
          startDate: 'not-a-date',
          endDate: '2099-06-10',
        }),
      ).rejects.toThrow('Invalid date format');
    });

    it('should throw BadRequestException when non-SICK leave is entirely in the past', async () => {
      await expect(
        service.requestLeave(userId, {
          leaveType: 'ANNUAL',
          startDate: '2020-01-01',
          endDate: '2020-01-05',
        }),
      ).rejects.toThrow('dates entirely in the past');
    });

    it('should allow SICK leave submitted for past dates', async () => {
      // No overlap
      mockLeaveRepo.createQueryBuilder.mockReturnValue(buildQb(null));
      mockLeaveRepo.create.mockReturnValue({ leaveType: 'SICK' });
      mockLeaveRepo.save.mockResolvedValue({ leaveType: 'SICK', status: LeaveStatus.PENDING });

      const result = await service.requestLeave(userId, {
        leaveType: 'SICK',
        startDate: '2020-01-01',
        endDate: '2020-01-05',
      });

      expect(result.status).toBe(LeaveStatus.PENDING);
    });

    it('should throw BadRequestException when an overlapping PENDING leave exists', async () => {
      const conflicting = {
        id: 'conflict-id',
        status: LeaveStatus.PENDING,
        leaveType: 'ANNUAL',
        startDate: '2099-06-12',
        endDate: '2099-06-18',
      };
      // Employee QB resolves the employee; leave QB resolves conflicting leave
      mockEmployeeRepo.createQueryBuilder.mockReturnValue(buildQb(mockEmployee));
      mockLeaveRepo.createQueryBuilder.mockReturnValue(buildQb(conflicting));

      await expect(
        service.requestLeave(userId, {
          leaveType: 'CASUAL',
          startDate: '2099-06-15',
          endDate: '2099-06-20',
        }),
      ).rejects.toThrow('overlapping');
    });

    it('should throw BadRequestException when an overlapping APPROVED leave exists', async () => {
      const conflicting = {
        id: 'conflict-id',
        status: LeaveStatus.APPROVED,
        leaveType: 'SICK',
        startDate: '2099-07-01',
        endDate: '2099-07-07',
      };
      mockEmployeeRepo.createQueryBuilder.mockReturnValue(buildQb(mockEmployee));
      mockLeaveRepo.createQueryBuilder.mockReturnValue(buildQb(conflicting));

      await expect(
        service.requestLeave(userId, {
          leaveType: 'ANNUAL',
          startDate: '2099-07-05',
          endDate: '2099-07-10',
        }),
      ).rejects.toThrow('overlapping');
    });

    it('should create and save the leave when all validations pass', async () => {
      // No overlap
      mockLeaveRepo.createQueryBuilder.mockReturnValue(buildQb(null));
      mockLeaveRepo.create.mockReturnValue({ leaveType: 'ANNUAL' });
      mockLeaveRepo.save.mockResolvedValue({ leaveType: 'ANNUAL', status: LeaveStatus.PENDING });

      const result = await service.requestLeave(userId, {
        leaveType: 'ANNUAL',
        startDate: '2099-08-01',
        endDate: '2099-08-07',
      });

      expect(mockLeaveRepo.create).toHaveBeenCalledTimes(1);
      expect(mockLeaveRepo.save).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(LeaveStatus.PENDING);
    });
  });
});
