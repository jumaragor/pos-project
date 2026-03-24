import { PropsWithChildren } from "react";

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ className, children }: CardProps) {
  return <section className={className ? `card ${className}` : "card"}>{children}</section>;
}
