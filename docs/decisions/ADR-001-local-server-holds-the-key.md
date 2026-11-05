# ADR-001: Servidor local guarda a chave; o navegador nunca a recebe

## Status

Accepted

## Date

2026-11-05

## Context

O painel usa a Garmin Connect Personal API com uma chave pessoal (validade de 30 a 365 dias) que dá acesso de leitura a dados de saúde e treino. Requisitos:

- Rodar só na máquina do usuário, instalável por outras pessoas com a própria chave.
- A chave não pode chegar ao navegador, onde ficaria exposta a extensões, scripts e devtools. Além disso, o CORS provavelmente bloquearia chamadas diretas à Garmin.
- Quem não é desenvolvedor precisa conseguir configurar a chave sem editar arquivos.

## Decision

- **Servidor local como intermediário:** um servidor Node (Hono) local troca a chave por token, que é guardado em memória até expirar. Ele expõe uma lista fechada de rotas próprias (`/api/runs`, `/api/profile`, ...), que devolvem só os campos usados pelo painel. **Não é um proxy genérico:** o navegador nunca escolhe a URL da Garmin.
- **Onde a chave vive:** no `.env` da pasta do projeto. O servidor relê o arquivo a cada troca de token, então uma chave renovada vale sem reiniciar.
- **Tela de Configuração:** a chave digitada viaja **do navegador para o servidor** num `POST /api/settings/key`. O servidor testa a chave com a Garmin antes de gravar (arquivo temporário + renomeação) e nunca a devolve nem a registra em log.
- **Proteções do servidor:**
  - escuta só em `127.0.0.1`;
  - toda requisição `/api` precisa de `Host` local, contra DNS rebinding;
  - a escrita da chave exige `Origin` local, contra CSRF;
  - a escrita da chave exige corpo JSON, o que força um preflight CORS que o servidor nunca autoriza;
  - a chave precisa estar no alfabeto da Personal API, para não haver injeção de linhas no `.env`.
- **Produção:** `npm start` serve o web compilado e a API na mesma origem, com CSP `default-src 'self'`.

## Alternatives Considered

### Chamar a Garmin direto do navegador

- **Prós:** sem servidor.
- **Contras:** a chave e o token ficariam no navegador, e o CORS provavelmente bloquearia as chamadas.
- **Rejeitada.**

### Guardar a chave no navegador (localStorage)

- **Prós:** configuração simples.
- **Contras:** qualquer script da página ou extensão poderia ler a chave. Também seria preciso mandar a chave ao servidor a cada requisição.
- **Rejeitada.**

### Exigir edição manual do `.env`

- **Prós:** nenhuma rota de escrita, logo nenhuma superfície de CSRF.
- **Contras:** inviável para quem não é desenvolvedor, que é justamente o público da instalação por outras pessoas.
- **Rejeitada.** A rota de escrita foi mantida, com as proteções acima.

### Cofre do sistema operacional (Credential Manager / Keychain)

- **Prós:** a chave não fica em texto puro em disco.
- **Contras:** exige dependência nativa por plataforma, o que complica a instalação.
- **Adiada.** Vale reavaliar se o painel for distribuído como executável.

## Consequences

- A chave fica em texto puro no `.env`, protegida pelas permissões do usuário no sistema operacional e pelo `.gitignore`. O README alerta para nunca compartilhar esse arquivo.
- Toda rota nova do servidor herda automaticamente a exigência de `Host` local.
- Clientes que não sejam navegador, como `curl`, podem gravar a chave sem enviar `Origin`. Isso é aceitável porque exige acesso local à máquina, e quem tem esse acesso já consegue ler o `.env`.
