export default function Home() {
  return (
    <main className="pagina">
      <header>
        <p className="sobrenome">
          Desapegue-se · O Festival dos Futuros que Queremos
        </p>
        <h1 className="titulo">Moeda Social Desapego</h1>
        <p className="subtitulo">
          Uma nova economia <em>é possível</em>
        </p>
      </header>

      <figure className="cedulas">
        <img
          className="cedula cedula--frente"
          src="/cedula-frente-v2.webp"
          width={916}
          height={414}
          alt="Frente da cédula de 1 Desapego: uma roda de pessoas de mãos dadas ao redor do símbolo da reciclagem, com o lema “Desapegue-se — o festival dos futuros que queremos”."
          fetchPriority="high"
          decoding="async"
        />
        <img
          className="cedula cedula--verso"
          src="/cedula-verso-v2.webp"
          width={916}
          height={414}
          alt="Verso da cédula de 1 Desapego: economia circular, sustentabilidade, economia solidária e abundância, com um QR code para a carteira digital e o lema “a riqueza está em circular”."
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
        <button type="button" className="botao" disabled aria-describedby="aviso-conta">
          Clique para acessar sua conta
        </button>
        <p className="aviso" id="aviso-conta">
          Em breve
        </p>
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
