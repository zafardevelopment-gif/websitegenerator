export interface AuthState {
  step: "email" | "otp";
  email: string;
  error: string | null;
  message: string | null;
}

export const INITIAL_AUTH_STATE: AuthState = {
  step: "email",
  email: "",
  error: null,
  message: null,
};
