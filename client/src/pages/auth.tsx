import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { setContactId, getContactId } from "@/lib/contactApiClient";
import { setUserId, getUserId } from "@/lib/userIdStorage";
import { Capacitor } from "@capacitor/core";
import { registerPushNotifications } from "@/lib/push-notifications";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { COUNTRIES } from "@/lib/constants";
import logoImage from "@assets/heyteam 1_1760877824955.png";
import { Alert, AlertDescription } from "@/components/ui/alert";

const LAST_EMAIL_KEY = "heyteam_last_email";

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(2, "Company name must be at least 2 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  const lastEmail = typeof window !== "undefined" ? localStorage.getItem(LAST_EMAIL_KEY) || "" : "";

  // Read referral code from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || params.get("referralCode");
    if (ref) {
      setReferralCode(ref);
      setActiveTab("register"); // Auto-switch to register tab
    }
  }, []);

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
      firstName: "",
      lastName: "",
      email: "",
      countryCode: "GB",
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

  const isMobileDevice = () => {
    if (typeof navigator === "undefined") return false;
    return /android|iphone|ipad|ipod|windows phone/i.test(navigator.userAgent.toLowerCase());
  };

  const isPwaInstalled = () => {
    if (typeof window === "undefined") return false;
    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
    const standaloneMatch = mediaQuery?.matches;
    const navigatorStandalone = (window.navigator as any)?.standalone;
    return Boolean(standaloneMatch || navigatorStandalone);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: any) => {
      event.preventDefault();
      setDeferredPrompt(event);
      if (activeTab === "login" && isMobileDevice() && !isPwaInstalled()) {
        setShowPwaBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "login" && isMobileDevice() && !isPwaInstalled()) {
      setShowPwaBanner(true);
    } else if (activeTab !== "login") {
      setShowPwaBanner(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isPwaInstalled()) {
      setShowPwaBanner(false);
      return;
    }

    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
    if (!mediaQuery) return;

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setShowPwaBanner(false);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === "accepted") {
        setShowPwaBanner(false);
      }
    } catch (error) {
      console.error("PWA install prompt failed", error);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      // Get API base URL for native apps
      const getApiBaseUrl = () => {
        if (Capacitor.isNativePlatform()) {
          return "https://portal.heyteam.ai";
      }
        return "";
      };
      
      const baseUrl = getApiBaseUrl();
      
      // Try mobile login first (works for both contacts and users in native apps)
      // For native apps, always use mobile login endpoint
      if (Capacitor.isNativePlatform()) {
        try {
          const loginUrl = `${baseUrl}/api/mobile/auth/login`;
          const res = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(data),
          });
          
          if (res.ok) {
            const loginData = await res.json();
            console.log("[Auth] Mobile login response:", loginData);
      
            // Store the appropriate ID based on type
            if (loginData.type === "contact") {
              const contactIdToStore = loginData.contactId || loginData.id;
              if (contactIdToStore) {
                console.log("[Auth] Storing contactId:", contactIdToStore);
                setContactId(contactIdToStore);
              } else {
                console.error("[Auth] No contactId found in response:", loginData);
              }
            } else if (loginData.type === "user") {
              const userIdToStore = loginData.userId || loginData.id;
              if (userIdToStore) {
                console.log("[Auth] Storing userId:", userIdToStore);
                setUserId(userIdToStore);
              } else {
                console.error("[Auth] No userId found in response:", loginData);
              }
            }
            
            // Return the login data (works for both contacts and users)
            return loginData;
          } else {
            const errorText = await res.text();
            console.log("[Auth] Mobile login failed:", res.status, errorText);
            throw new Error(errorText || "Mobile login failed");
        }
      } catch (error) {
          console.error("[Auth] Mobile login error:", error);
          throw error; // Re-throw to show error to user
        }
      }
      
      // For web, use regular login endpoint
      const loginUrl = baseUrl ? `${baseUrl}/api/auth/login` : "/api/auth/login";
      const res = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Login failed");
      }
      
      return await res.json();
    },
    onSuccess: (data, variables) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_EMAIL_KEY, variables.email);
      }
      
      console.log("[Auth] Login success, data:", data);
      
      toast({ title: "Login successful" });
      
      // Redirect based on account type
      if (data.type === "contact") {
        // Verify contactId is stored
        const storedContactId = getContactId();
        console.log("[Auth] Contact login - stored contactId:", storedContactId);
        
        if (!storedContactId) {
          console.error("[Auth] ERROR: contactId was not stored! Data:", data);
          toast({
            title: "Login Error",
            description: "Failed to save session. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/mobile/auth/me"] });
        
        // Small delay to ensure storage is complete before redirecting
        // Push notifications will be registered in ContactApp after redirect
        setTimeout(() => {
          setLocation("/contact/dashboard");
        }, 100);
          } else {
        // Verify userId is stored (for mobile users)
        if (Capacitor.isNativePlatform()) {
          const storedUserId = getUserId();
          console.log("[Auth] User login - stored userId:", storedUserId);
          
          if (!storedUserId) {
            console.error("[Auth] ERROR: userId was not stored! Data:", data);
            toast({
              title: "Login Error",
              description: "Failed to save session. Please try again.",
              variant: "destructive",
            });
            return;
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        // Small delay to ensure storage is complete and query can use the userId
        setTimeout(() => {
          setLocation("/jobs");
        }, 100);
      }
    },
    onError: (error: any) => {
      let errorMessage = "Invalid credentials";
      
      // Try to parse the error message from the response
      try {
        const errorString = error.message || "";
        // Error format is "status: jsonString"
        const parts = errorString.split(": ");
        if (parts.length > 1) {
          const jsonPart = parts.slice(1).join(": ");
          const parsed = JSON.parse(jsonPart);
          errorMessage = parsed.message || errorMessage;
        }
      } catch {
        // If parsing fails, use default message
      }
      
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      // Include referralCode if present
      const payload = referralCode 
        ? { ...data, referralCode }
        : data;
      return await apiRequest("POST", "/api/auth/register", payload);
    },
    onSuccess: () => {
      toast({ title: "Registration successful" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        // Redirect new users straight to the jobs dashboard with a one-time tour flag
        setLocation("/jobs?tour=signup");
    },
    onError: (error: any) => {
      let errorMessage = "Could not create account";
      
      // Try to parse the error message from the response
      try {
        const errorString = error.message || "";
        // Error format is "status: jsonString"
        const parts = errorString.split(": ");
        if (parts.length > 1) {
          const jsonPart = parts.slice(1).join(": ");
          const parsed = JSON.parse(jsonPart);
          errorMessage = parsed.message || errorMessage;
        }
      } catch {
        // If parsing fails, use default message
      }
      
      toast({
        title: "Registration failed",
        description: errorMessage,
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
      let errorMessage = "Could not process request";
      
      // Try to parse the error message from the response
      try {
        const errorString = error.message || "";
        // Error format is "status: jsonString"
        const parts = errorString.split(": ");
        if (parts.length > 1) {
          const jsonPart = parts.slice(1).join(": ");
          const parsed = JSON.parse(jsonPart);
          errorMessage = parsed.message || errorMessage;
        }
      } catch {
        // If parsing fails, use default message
      }
      
      toast({
        title: "Request failed",
        description: errorMessage,
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
              <div className="space-y-4 text-base">
                {[ 
                  "Fill jobs fast without spending hours on phone calls or WhatsApp messages.",
                  "Keep your team organised with automatic rota updates and instant SMS replies.",
                  "See everything in one place — jobs, availability, and confirmations on your dashboard."
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <Check className="mt-1 h-5 w-5 text-white" />
                    <span>{item}</span>
                  </div>
                ))}
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
            <div className="space-y-4 text-base">
              {[ 
                "Fill jobs fast without spending hours on phone calls or WhatsApp messages.",
                "Keep your team organised with automatic rota updates and instant SMS replies.",
                "See everything in one place — jobs, availability, and confirmations on your dashboard."
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="mt-1 h-5 w-5 text-white" />
                  <span>{item}</span>
                </div>
              ))}
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

                {showPwaBanner && (
                  <div className="relative rounded-xl border border-border bg-muted p-4 text-sm text-foreground transition-colors">
                    <button
                      type="button"
                      onClick={() => setShowPwaBanner(false)}
                      className="absolute right-3 top-3 text-muted-foreground transition hover:text-foreground"
                      aria-label="Dismiss PWA install banner"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="pr-6 space-y-3">
                      <div>
                        <h3 className="text-base font-semibold">Install HeyTeam on your phone</h3>
                        <p className="text-xs text-muted-foreground">
                          Add HeyTeam to your home screen for faster access and instant notifications.
                        </p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          <span className="font-semibold">iOS:</span> Tap the <span className="font-semibold">Share</span> button in Safari, then choose <span className="font-semibold">Add to Home Screen</span>.
                        </p>
                        <p>
                          <span className="font-semibold">Android:</span> Tap the browser menu (<span aria-hidden>⋮</span>) and select <span className="font-semibold">Install app</span> or <span className="font-semibold">Add to Home screen</span>.
                        </p>
                      </div>
                      {deferredPrompt && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleInstallClick}
                          className="text-xs"
                          data-testid="button-install-pwa"
                        >
                          Install now
                        </Button>
                      )}
                    </div>
                  </div>
                )}

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
                              autoComplete="username"
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
                          <div className="relative">
                            <FormControl>
                              <Input
                                {...field}
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                className="h-11 pr-10"
                                data-testid="input-login-password"
                                autoComplete="current-password"
                              />
                            </FormControl>
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground focus:outline-none"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label="Toggle password visibility"
                              data-testid="button-toggle-password"
                            >
                              {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
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
                    variant="ghost"
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

                {referralCode && (
                  <Alert className="bg-primary/10 border-primary/20" data-testid="alert-referral">
                    <AlertDescription className="text-sm">
                      ✨ You're signing up with a partner referral code
                    </AlertDescription>
                  </Alert>
                )}

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="John"
                                className="h-11"
                                data-testid="input-register-firstname"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Doe"
                                className="h-11"
                                data-testid="input-register-lastname"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

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
                          <div className="relative">
                            <FormControl>
                              <Input
                                {...field}
                                type={showRegisterPassword ? "text" : "password"}
                                placeholder="Create a password"
                                className="h-11 pr-10"
                                data-testid="input-register-password"
                              />
                            </FormControl>
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground focus:outline-none"
                              onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                              aria-label="Toggle password visibility"
                              data-testid="button-toggle-register-password"
                            >
                              {showRegisterPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
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
                          <div className="relative">
                            <FormControl>
                              <Input
                                {...field}
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm your password"
                                className="h-11 pr-10"
                                data-testid="input-register-confirm"
                              />
                            </FormControl>
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground focus:outline-none"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              aria-label="Toggle password visibility"
                              data-testid="button-toggle-confirm-password"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-5 w-5" />
                              ) : (
                                <Eye className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <p className="text-xs text-muted-foreground">
                      By signing up, you agree to our{" "}
                      <a href="https://heyteam.ai/termsandconditions" className="text-primary">Terms of Service</a> and{" "}
                      <a href="https://heyteam.ai/privacypolicy" className="text-primary">Privacy Policy</a>
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
                    variant="ghost"
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
