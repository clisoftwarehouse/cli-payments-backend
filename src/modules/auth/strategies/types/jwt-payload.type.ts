import { User } from '@/modules/users/domain/user';
import { Session } from '@/modules/session/domain/session';

export type JwtPayloadType = Pick<User, 'id' | 'role'> & {
  sessionId: Session['id'];
  iat: number;
  exp: number;
};
