import { Reflector } from '@nestjs/core';
import { PermissionBit } from 'constants/permissions';

export const Public = Reflector.createDecorator();
export const Perms = Reflector.createDecorator<PermissionBit[]>();
