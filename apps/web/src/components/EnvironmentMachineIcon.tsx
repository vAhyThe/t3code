import type { EnvironmentMachineKind } from "@t3tools/contracts";
import { CloudIcon, LaptopIcon, MonitorIcon, ServerIcon, type LucideProps } from "lucide-react";
import type { FunctionComponent, SVGProps } from "react";
import { LinuxIcon } from "./Icons";
import { currentTranslator } from "~/i18n/I18nProvider";

function LucideLike(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    />
  );
}

function MacMiniIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LucideLike {...props}>
      <rect width="20" height="8" x="2" y="8" rx="2" />
      <path d="M6 12h.01" />
    </LucideLike>
  );
}

function MacStudioIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <LucideLike {...props}>
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M7 15h.01M11 15h.01M15 15h.01" />
    </LucideLike>
  );
}

const ICON_BY_KIND: Record<EnvironmentMachineKind, FunctionComponent<LucideProps>> = {
  server: ServerIcon,
  cloud: CloudIcon,
  linux: LinuxIcon,
  desktop: MonitorIcon,
  laptop: LaptopIcon,
  "mac-mini": MacMiniIcon,
  "mac-studio": MacStudioIcon,
};

export const ENVIRONMENT_MACHINE_KIND_LABELS: Record<EnvironmentMachineKind, string> = {
  get server() {
    return currentTranslator()("shellRest.machineKindServer");
  },
  get cloud() {
    return currentTranslator()("shellRest.machineKindCloud");
  },
  get linux() {
    return currentTranslator()("shellRest.machineKindLinux");
  },
  get desktop() {
    return currentTranslator()("shellRest.machineKindDesktop");
  },
  get laptop() {
    return currentTranslator()("shellRest.machineKindLaptop");
  },
  get "mac-mini"() {
    return currentTranslator()("shellRest.machineKindMiniPc");
  },
  get "mac-studio"() {
    return currentTranslator()("shellRest.machineKindWorkstation");
  },
};
export function environmentMachineIcon(
  kind: EnvironmentMachineKind,
): FunctionComponent<LucideProps> {
  return ICON_BY_KIND[kind];
}

export function EnvironmentMachineIcon({
  kind,
  ...props
}: LucideProps & { readonly kind: EnvironmentMachineKind }) {
  const Icon = ICON_BY_KIND[kind];
  return <Icon {...props} />;
}
