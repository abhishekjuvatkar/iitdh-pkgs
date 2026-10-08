import React, { useEffect, useRef } from "react";
import { useIITDHAuth } from "./IITDHAuthProvider.js";

export interface IITDHLoginButtonProps {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number | string;
  className?: string;
  customButton?: React.ReactNode;
}

export const IITDHLoginButton: React.FC<IITDHLoginButtonProps> = ({
  theme = "outline",
  size = "large",
  text = "signin_with",
  shape = "rectangular",
  width = 280,
  className = "",
  customButton,
}) => {
  const { user, triggerGoogleSignIn, renderGoogleButton } = useIITDHAuth();
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user && btnRef.current) {
      renderGoogleButton(btnRef.current, {
        theme,
        size,
        text,
        shape,
        width,
      });
    }
  }, [user, theme, size, text, shape, width, renderGoogleButton]);

  if (user) {
    return null;
  }

  if (customButton) {
    return (
      <div onClick={triggerGoogleSignIn} style={{ cursor: "pointer" }} className={className}>
        {customButton}
      </div>
    );
  }

  return <div ref={btnRef} className={className} style={{ minHeight: "44px", display: "inline-flex" }} />;
};

export default IITDHLoginButton;
