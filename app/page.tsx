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
          src="/cedula-frente.webp"
          width={680}
          height={286}
          alt="Frente da cédula de 1 Desapego: Circula ideias, impulsiona pessoas, transforma realidades."
          fetchPriority="high"
          decoding="async"
        />
        <img
          className="cedula cedula--verso"
          src="/cedula-verso.webp"
          width={664}
          height={270}
          alt="Verso da cédula de 1 Desapego: Cuidar do agora para um amanhã mais justo e regenerativo, sobre uma paisagem do Rio de Janeiro."
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
