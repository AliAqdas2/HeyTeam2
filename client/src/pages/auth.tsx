import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { COUNTRIES } from "@/lib/constants";
import illustrationImage from "@assets/HeyTeam Login Page Animation_1761223879122.gif";
import logoImage from "@assets/heyteam 1_1760877824955.png";

const LAST_EMAIL_KEY = "heyteam_last_email";

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Valid email is required"),
  countryCode: z.string().min(1, "Country is required"),
  mobileNumber: z.string().min(5, "Mobile number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const lastEmail = typeof window !== "undefined" ? localStorage.getItem(LAST_EMAIL_KEY) || "" : "";

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: lastEmail,
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      countryCode: "US",
      mobileNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      return await apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: (_, variables) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_EMAIL_KEY, variables.email);
      }
      toast({ title: "Login successful" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      return await apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: () => {
      toast({ title: "Registration successful" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      return await apiRequest("POST", "/api/auth/forgot-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Check your email",
        description: "If the email exists, a reset link will be sent",
      });
      setShowForgotPassword(false);
      forgotPasswordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Request failed",
        description: error.message || "Could not process request",
        variant: "destructive",
      });
    },
  });

  const onLogin = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const onForgotPassword = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
  };

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="grid lg:grid-cols-2 w-full min-h-screen">
          {/* Left Panel - Teal */}
          <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-[#14b8a6] to-[#0d9488] p-12">
            <div className="max-w-lg text-white space-y-8">
              <div className="space-y-4">
                <img src={logoImage} alt="HeyTeam" className="w-48 brightness-0 invert" />
                <h1 className="text-4xl font-bold leading-tight">
                  One click to go<br />all digital.
                </h1>
              </div>
              <div className="flex items-center justify-center">
                <img src={illustrationImage} alt="Digital Management" className="w-full max-w-md rounded-lg" />
              </div>
            </div>
          </div>

          {/* Right Panel - Form */}
          <div className="flex items-center justify-center p-6 sm:p-12">
            <div className="w-full max-w-md space-y-8">
              <div className="lg:hidden mb-8">
                <img src={logoImage} alt="HeyTeam" className="w-40 mx-auto" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Reset Password</h2>
                <p className="text-muted-foreground">
                  Enter your email address and we'll send you a reset link
                </p>
              </div>

              <Form {...forgotPasswordForm}>
                <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPassword)} className="space-y-5">
                  <FormField
                    control={forgotPasswordForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="your@email.com"
                            className="h-11"
                            data-testid="input-forgot-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 h-11"
                      data-testid="button-back-to-login"
                    >
                      Back to Login
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-11"
                      disabled={forgotPasswordMutation.isPending}
                      data-testid="button-send-reset"
                    >
                      {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="grid lg:grid-cols-2 w-full min-h-screen">
        {/* Left Panel - Teal Gradient with Illustration */}
        <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-[#14b8a6] to-[#0d9488] p-12">
          <div className="max-w-lg text-white space-y-8">
            <div className="space-y-4">
              <img src={logoImage} alt="HeyTeam" className="w-48 brightness-0 invert" />
              <h1 className="text-4xl font-bold leading-tight">
                Stop calling around.<br />Just HeyTeam it.
              </h1>
            </div>
            <div className="flex items-center justify-center">
              <img src={illustrationImage} alt="Digital Management" className="w-full max-w-md rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md space-y-8">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8">
              <img src={logoImage} alt="HeyTeam" className="w-40 mx-auto" />
            </div>

            {/* Login Form */}
            {activeTab === "login" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold" data-testid="heading-login">Sign in</h2>
                  <p className="text-muted-foreground">Welcome back! Please enter your details</p>
                </div>

                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-5">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="your@email.com"
                              className="h-11"
                              data-testid="input-login-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                className="h-11 pr-10"
                                data-testid="input-login-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label="Toggle password visibility"
                                data-testid="button-toggle-password"
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm h-auto p-0 text-primary"
                        data-testid="button-forgot-password"
                      >
                        Forgot password?
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 text-base font-semibold"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </Form>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Don't have an account? </span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setActiveTab("register")}
                    className="h-auto p-0 text-primary font-semibold"
                    data-testid="link-to-register"
                  >
                    Sign up
                  </Button>
                </div>
              </div>
            )}

            {/* Register Form */}
            {activeTab === "register" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold" data-testid="heading-register">Sign up</h2>
                  <p className="text-muted-foreground">Create your account to get started</p>
                </div>

                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-5">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Your Company"
                              className="h-11"
                              data-testid="input-register-username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="your@email.com"
                              className="h-11"
                              data-testid="input-register-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-5 gap-2">
                      <FormField
                        control={registerForm.control}
                        name="countryCode"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Country</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-11" data-testid="select-country-code">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {COUNTRIES.map((country) => (
                                  <SelectItem key={country.code} value={country.code}>
                                    {country.dialCode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="mobileNumber"
                        render={({ field }) => (
                          <FormItem className="col-span-3">
                            <FormLabel>Mobile No</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="tel"
                                placeholder="Mobile number"
                                className="h-11"
                                data-testid="input-register-mobile"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showRegisterPassword ? "text" : "password"}
                                placeholder="Create a password"
                                className="h-11 pr-10"
                                data-testid="input-register-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                aria-label="Toggle password visibility"
                                data-testid="button-toggle-register-password"
                              >
                                {showRegisterPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your password"
                                className="h-11 pr-10"
                                data-testid="input-register-confirm"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label="Toggle password visibility"
                                data-testid="button-toggle-confirm-password"
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <p className="text-xs text-muted-foreground">
                      By signing up, you agree to our{" "}
                      <span className="text-primary">Terms of Service</span> and{" "}
                      <span className="text-primary">Privacy Policy</span>
                    </p>

                    <Button
                      type="submit"
                      className="w-full h-11 text-base font-semibold"
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? "Creating account..." : "Get Started"}
                    </Button>
                  </form>
                </Form>

                <div className="text-center text-sm">
                  <span className="text-muted-foreground">Already a member? </span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setActiveTab("login")}
                    className="h-auto p-0 text-primary font-semibold"
                    data-testid="link-to-login"
                  >
                    Sign in
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
