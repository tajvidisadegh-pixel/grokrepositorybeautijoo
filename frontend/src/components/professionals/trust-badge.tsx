/** Trust badges disabled by product decision — must not show on public surfaces. */

type Props = {
  status?: string | null;
  verifiedAt?: string | Date | null;
  size?: 'sm' | 'md';
  className?: string;
};

export function TrustBadge(_props: Props) {
  return null;
}
