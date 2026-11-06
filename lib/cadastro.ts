/**
 * Interruptor do cadastro. Com CADASTRO_ABERTO=0 a landing volta a dizer "em
 * breve" e só os e-mails de ADMIN_EMAILS conseguem pedir código de login; quem
 * já está logado continua logado. Sem a variável, o cadastro está aberto.
 *
 * A landing é gerada no build, então mudar a variável só vale depois de um
 * novo deploy (o Railway faz um sozinho quando a variável muda).
 */
export const cadastroAberto = process.env.CADASTRO_ABERTO !== "0";
