import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const {
    login,
    signup
  } = useAuth();
  const navigate = useNavigate();
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success("Welcome back!", {
          description: "You've successfully logged in."
        });
        navigate('/');
      } else {
        toast.error("Login failed", {
          description: result.error || "Please check your credentials and try again."
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred."
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match", {
        description: "Please make sure your passwords match."
      });
      return;
    }
    if (password.length < 6) {
      toast.error("Password too short", {
        description: "Password must be at least 6 characters."
      });
      return;
    }
    setIsLoading(true);
    try {
      const result = await signup(email, password);
      if (result.success) {
        toast.success("Account created!", {
          description: "Please check your email to verify your account. After verification, an existing admin needs to grant you admin access."
        });
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setActiveTab('login');
      } else {
        toast.error("Signup failed", {
          description: result.error || "Please try again."
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred."
      });
    } finally {
      setIsLoading(false);
    }
  };
  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };
  return <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          
          <h1 className="text-2xl font-bold text-foreground text-center font-sans bg-transparent">​Synergy HR Admin Portal         </h1>
          <p className="text-muted-foreground mt-1">Admin Portal</p>
        </div>

        {/* Login/Signup Card */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={v => {
            setActiveTab(v);
            resetForm();
          }}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="admin@company.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading}>
                    {isLoading ? <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </> : 'Sign in'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input id="confirm-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} className="h-11" />
                  </div>

                  <Button type="submit" className="w-full h-11 font-medium" disabled={isLoading}>
                    {isLoading ? <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </> : 'Create account'}
                  </Button>
                </form>

                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    <span className="font-medium">Note:</span> After signing up, an admin must grant you admin access before you can log in.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Info */}
            <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                <span className="font-medium">Note:</span> Only users with admin role can access this portal
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Employee link */}
        <div className="mt-6 text-center">
          <Link to="/employee" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
            Employee Portal
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Protected by Supabase authentication
        </p>
      </div>
    </div>;
};
export default Login;