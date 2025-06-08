// src/index.d.ts
import 'express';

interface Locals {
  message?: string;
}

declare module 'express' {
  export interface Response {
    locals: Locals;
  }
}
