import { Elysia } from 'elysia';
import { MessageObject } from '../utils/message';

// 权限配置
const PERMISSIONS = {
  SUPER_ADMIN: '1259598502',
  ADMINS: ['1259598502'],
  ADMIN_COMMANDS: [
    'meme-add',
    'meme-edit', 
    'meme-delete',
  ]
};

// 用户信息接口
interface AuthUser {
  id: string;
  name: string;
  role: 'super_admin' | 'admin' | 'user';
}

// 从 session 中提取用户信息
function extractUser(body: any): AuthUser | null {
  if (!body || typeof body !== 'object' || !('session' in body)) {
    return null;
  }
  
  const session = body.session;
  const userId = session?.user?.id;
  const userName = session?.user?.name || 'Unknown';
  
  if (!userId) return null;
  
  let role: 'super_admin' | 'admin' | 'user' = 'user';
  if (userId === PERMISSIONS.SUPER_ADMIN) {
    role = 'super_admin';
  } else if (PERMISSIONS.ADMINS.includes(userId)) {
    role = 'admin';
  }
  
  return {
    id: userId,
    name: userName,
    role
  };
}



// 创建权限错误响应
function createAuthError(message: string): MessageObject {
  return {
    type: "text",
    content: `❌ ${message}`
  };
}

// 权限检查 macro
export const authPlugin = new Elysia()
  .macro({
    // 需要特定用户权限
    requireUser: (userId: string) => ({
      resolve({ body, set }) {
        const user = extractUser(body);
        
        if (!user) {
          set.status = 401;
          return createAuthError('认证失败，无法获取用户信息');
        }
        
        if (user.id !== userId) {
          set.status = 403;
          return createAuthError(`此功能仅限用户 ${userId} 使用`);
        }
        
        return { user };
      }
    }),
    
    // 需要管理员权限
    requireAdmin: () => ({
      resolve({ body, set }) {
        const user = extractUser(body);
        
        if (!user) {
          set.status = 401;
          return createAuthError('认证失败，无法获取用户信息');
        }
        
        if (user.role === 'user') {
          set.status = 403;
          return createAuthError('权限不足，此功能仅限管理员使用');
        }
        
        return { user };
      }
    }),
    
    // 需要超级管理员权限
    requireSuperAdmin: () => ({
      resolve({ body, set }) {
        const user = extractUser(body);
        
        if (!user) {
          set.status = 401;
          return createAuthError('认证失败，无法获取用户信息');
        }
        
        if (user.role !== 'super_admin') {
          set.status = 403;
          return createAuthError('权限不足，此功能仅限超级管理员使用');
        }
        
        return { user };
      }
    })
  })
  // 全局错误处理
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400;
      return createAuthError('请求参数验证失败');
    }
    
    console.error('Auth middleware error:', error);
    return createAuthError('认证服务异常');
  });

// 其余代码保持不变...
export class AuthManager {
  static addAdmin(userId: string): boolean {
    if (!PERMISSIONS.ADMINS.includes(userId)) {
      PERMISSIONS.ADMINS.push(userId);
      return true;
    }
    return false;
  }
  
  static removeAdmin(userId: string): boolean {
    if (userId === PERMISSIONS.SUPER_ADMIN) {
      return false;
    }
    
    const index = PERMISSIONS.ADMINS.indexOf(userId);
    if (index > -1) {
      PERMISSIONS.ADMINS.splice(index, 1);
      return true;
    }
    return false;
  }
  
  static getAdmins(): string[] {
    return [...PERMISSIONS.ADMINS];
  }
  
  static getUserRole(userId: string): 'super_admin' | 'admin' | 'user' {
    if (userId === PERMISSIONS.SUPER_ADMIN) return 'super_admin';
    if (PERMISSIONS.ADMINS.includes(userId)) return 'admin';
    return 'user';
  }
}

// 命令权限检查中间件
export function commandAuth(requiredRole: 'admin' | 'super_admin' = 'admin') {
  return {
    beforeHandle({ body, path, set }: { body: any; path: string; set: any }) {
      const command = path.replace('/', '');
      
      // 如果不是需要权限的命令，直接通过
      if (!PERMISSIONS.ADMIN_COMMANDS.includes(command)) {
        return;
      }
      
      const user = extractUser(body);
      
      if (!user) {
        set.status = 401;
        return createAuthError('认证失败，无法获取用户信息');
      }
      
      // 检查权限级别
      if (requiredRole === 'super_admin' && user.role !== 'super_admin') {
        set.status = 403;
        return createAuthError(`命令 "${command}" 需要super权限喵`);
      }
      
      if (requiredRole === 'admin' && user.role === 'user') {
        set.status = 403;
        return createAuthError(`命令 "${command}" 需要pro权限喵`);
      }
      
      // 在这里记录日志
      console.log(`🔐 [${user.id}:${user.name}] -> ${path}`);
    }
  };
}