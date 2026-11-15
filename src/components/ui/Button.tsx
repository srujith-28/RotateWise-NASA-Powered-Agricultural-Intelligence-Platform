import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#174C3C] text-white border border-[#174C3C] hover:bg-[#113A2E] active:bg-[#0D2E24]',
  secondary:
    'bg-[#EAF2EC] text-[#174C3C] border border-[#C6DCD0] hover:bg-[#DCEBDF]',
  outline:
    'bg-white text-[#17231E] border border-[#E1E8E2] hover:bg-[#F7F8F5] hover:border-[#CAD6CC]',
  ghost:
    'bg-transparent text-[#65736B] border border-transparent hover:bg-[#F7F8F5] hover:text-[#17231E]',
  danger:
    'bg-white text-[#B91C1C] border border-[#E5C5C5] hover:bg-[#FEF2F2]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
};

export function Button({
  variant = 'outline',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center font-medium transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
