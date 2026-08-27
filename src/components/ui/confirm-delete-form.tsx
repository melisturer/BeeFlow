"use client";

import type { ReactNode } from "react";

type ConfirmDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
};

/** Silmeden önce tarayıcı onayı ister. */
export function ConfirmDeleteForm({
  action,
  message,
  children,
  className,
}: ConfirmDeleteFormProps) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
