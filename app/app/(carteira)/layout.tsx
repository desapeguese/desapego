import { exigirPessoa } from "@/lib/sessao";
import { TempoReal } from "./tempo-real";

/** Tudo aqui dentro exige login e cadastro completo. */
export default async function LayoutDaCarteira({ children }: Readonly<{ children: React.ReactNode }>) {
  await exigirPessoa();
  return (
    <>
      {children}
      <TempoReal />
    </>
  );
}
