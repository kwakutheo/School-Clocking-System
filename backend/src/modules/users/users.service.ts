import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id }, relations: ['tenant'] });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.tenant', 'tenant')
      .where('user.username = :id OR user.email = :id OR user.phone = :id', {
        id: identifier,
      })
      .getOne();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async create(data: {
    fullName: string;
    username?: string;
    email?: string;
    phone?: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.repo.create({
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      role: data.role ?? UserRole.EMPLOYEE,
    });
    return this.repo.save(user);
  }

  async update(
    id: string,
    data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<User> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  /** Serialize user to safe public shape — never expose passwordHash. */
  toPublic(user: User) {
    const { passwordHash: _, ...safe } = user;
    // Explicitly attach tenant if it was loaded, to prevent spread operator from stripping it
    if (user.tenant) {
      (safe as any).tenant = user.tenant;
    }
    return safe;
  }

  async updateFcmToken(id: string, token: string | null): Promise<void> {
    await this.repo.update(id, { fcmToken: token });
  }
}
