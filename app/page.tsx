import { Workbench } from "@/components/workbench/Workbench";

export default function Home() {
  return <Workbench publicMode={process.env.PROTOALIGN_PUBLIC_MODE === "1"} />;
}
