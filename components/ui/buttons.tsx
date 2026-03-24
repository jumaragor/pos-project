import { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function PrimaryButton({ children, className, ...props }: ButtonProps) {
  const merged = className ? `btn-primary ${className}` : "btn-primary";
  return (
    <button {...props} className={merged}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className, ...props }: ButtonProps) {
  const merged = className ? `btn-secondary ${className}` : "btn-secondary";
  return (
    <button {...props} className={merged}>
      {children}
    </button>
  );
}
