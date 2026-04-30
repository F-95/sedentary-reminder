import { Button } from "antd";
import type { ButtonProps } from "antd";

export interface PrimaryButtonProps extends ButtonProps {
  loadingText?: string;
}

export default function PrimaryButton(props: PrimaryButtonProps): JSX.Element {
  const { children, loadingText = "处理中...", loading, ...rest } = props;
  return (
    <Button type="primary" loading={loading} {...rest}>
      {loading ? loadingText : children}
    </Button>
  );
}
