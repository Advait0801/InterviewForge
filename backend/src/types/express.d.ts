declare global {
  namespace Express {
    /** JWT + Passport OAuth user payload */
    interface User {
      id: string;
      email?: string;
      username?: string;
    }
  }
}

export {};
