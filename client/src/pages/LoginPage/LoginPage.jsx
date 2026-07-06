import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import api from '@/api';
import { useAuth } from '@/lib/auth-context';
import {
  getDefaultAuthorizedPath,
  isAuthenticatedSession,
} from '@/lib/auth-session';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { session, isRefreshing, login } = useAuth();

  useEffect(() => {
    if (isRefreshing || !isAuthenticatedSession(session)) return;

    const defaultPath = getDefaultAuthorizedPath(session);
    navigate(defaultPath || '/', { replace: true });
  }, [isRefreshing, navigate, session]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Введите email и пароль!');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(
        '/api/auth/login',
        { email, password },
        { skipAuthRedirect: true },
      );

      const nextSession = login(response.data);
      const firstName =
        nextSession.user?.firstName || nextSession.user?.first_name || email;

      toast.success(`Добро пожаловать, ${firstName}!`);

      const defaultPath = getDefaultAuthorizedPath(nextSession);
      navigate(defaultPath || '/', { replace: true });
    } catch (error) {
      console.error('Ошибка логина:', error);
      toast.error(error.response?.data?.message || 'Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-md border-border">
        <CardHeader className="space-y-1 text-center pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight">
            OneGame
          </CardTitle>
          <CardDescription>Введите email и пароль для входа</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          {/* Увеличили отступ между самими инпутами (space-y-5 вместо 4) */}
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@onegame.ru"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </CardContent>
          {/* Добавили padding-top (pt-2) и убрали возможную рамку/фон */}
          <CardFooter className="pt-6 pb-6 bg-transparent border-t-0">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
