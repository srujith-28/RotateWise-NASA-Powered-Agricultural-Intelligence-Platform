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
    'bg-[#174C3C] text-white border border-[#174C3C] shadow-[0_1px_2px_rgba(20,37,29,0.12)] hover:bg-[#133F32] active:bg-[#0F3328]',
  secondary:
    'bg-[#EAF2EC] text-[#174C3C] border border-transparent hover:bg-[#DDEADF]',
  outline:
    'bg-white text-[#18231E] border border-[#E7EBE7] hover:bg-[#F7F8F6] hover:border-[#D4DCD5]',
  ghost:
    'bg-transparent text-[#737D76] border border-transparent hover:bg-[#EEF2EE] hover:text-[#18231E]',
  danger:
    'bg-white text-[#B91C1C] border border-[#EBD2D2] hover:bg-[#FEF2F2]',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
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
      className={`inline-flex shrink-0 items-center justify-center font-medium transition-all duration-150 ease-out active:scale-[0.985] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
