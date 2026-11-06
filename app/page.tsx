import Link from "next/link";
import { cadastroAberto } from "@/lib/cadastro";

export default function Home() {
  return (
    <main className="pagina">
      <header>
        <img
          className="logo-landing"
          src="/logo-festival-branco-v1.png"
          width={900}
          height={313}
          alt="Desapegue-se"
        />
        <p className="sobrenome">
          O Festival dos Futuros que Queremos
        </p>
        <h1 className="titulo">Moeda Social Desapego</h1>
        <p className="subtitulo">
          Uma nova economia <em>é possível</em>
        </p>
      </header>

      <figure className="cedulas">
        {/* A cédula da roda de pessoas (o verso) fica por cima, a pedido da
            organização; as classes --frente/--verso dizem só a posição na pilha. */}
        <img
          className="cedula cedula--frente"
          src="/cedula-verso-v2.webp"
          width={916}
          height={414}
          alt="Verso da cédula de 1 Desapego: uma roda de pessoas de mãos dadas em volta de objetos trocados, com um QR code para a carteira digital e o lema “a riqueza está em circular”."
          fetchPriority="high"
          decoding="async"
        />
        <img
          className="cedula cedula--verso"
          src="/cedula-frente-v2.webp"
          width={916}
          height={414}
          alt="Frente da cédula de 1 Desapego: o símbolo do Festival, a reciclagem na cabeça, com o lema “Desapegue-se — o festival dos futuros que queremos”."
          decoding="async"
        />
      </figure>

      <p className="descricao">
        A Desapego é a moeda social do Festival: uma forma de dinheiro
        alternativo criada para circular nos territórios por onde passamos,
        estimular a economia local, promover inclusão financeira e fortalecer as
        relações entre pessoas, iniciativas e pequenos negócios. Em formato
        físico, por meio de cédulas, e virtual, através do aplicativo, a
        Desapego estimula o consumo no próprio território e a circulação interna
        da riqueza, contribuindo para gerar abundância, prosperidade e
        desenvolvimento local.
      </p>

      <div className="chamada">
        {cadastroAberto ? (
          <Link className="botao" href="/app">
            Acessar sua conta
          </Link>
        ) : (
          <>
            <button type="button" className="botao" disabled aria-describedby="aviso-conta">
              Acessar sua conta
            </button>
            <p className="aviso" id="aviso-conta">
              Em breve
            </p>
          </>
        )}
      </div>

      <footer className="rodape">
        <p>Desapego · mais que uma moeda, um movimento</p>
        <p>
          <a href="https://www.festivaldesapeguese.com.br/">
            festivaldesapeguese.com.br
          </a>
        </p>
      </footer>
    </main>
  );
}
