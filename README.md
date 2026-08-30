<div align="center">

# Ordem Paranormal 2 — Playtest Alpha

**Camada de regras do playtest alpha de _Ordem Paranormal RPG 2_ para o Foundry VTT.**

![Versões suportadas do Foundry](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dflat%26url%3Dhttps%3A%2F%2Fgithub.com%2FMagdielCAS%2Fop2-playtest-alpha%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
![CI](https://github.com/MagdielCAS/op2-playtest-alpha/actions/workflows/ci.yml/badge.svg)
![Downloads da última release](https://img.shields.io/github/downloads/MagdielCAS/op2-playtest-alpha/latest/total)

</div>

> Projeto não-oficial e independente, sem conteúdo dos livros. _Ordem Paranormal_ é uma criação de
> Rafael "Cellbit" Lange, publicada pela Jambô Editora.

---

## Sumário

- [Sobre](#sobre)
- [Status](#status)
- [Compatibilidade](#compatibilidade)
- [Instalação](#instalação)
- [Recursos principais](#recursos-principais)
- [Como usar](#como-usar)
  - [Criando um agente](#criando-um-agente)
  - [Fazendo um teste](#fazendo-um-teste)
  - [Críticos e falhas críticas](#críticos-e-falhas-críticas)
  - [Ímpeto do Executor](#ímpeto-do-executor)
  - [Ajuda](#ajuda)
  - [Montando uma cena de investigação](#montando-uma-cena-de-investigação)
  - [Jogando a cena de investigação](#jogando-a-cena-de-investigação)
  - [Desafios de acesso](#desafios-de-acesso)
  - [Ferimentos, traumas e combate](#ferimentos-traumas-e-combate)
  - [Rodadas, sobrecarga mental e fim de cena](#rodadas-sobrecarga-mental-e-fim-de-cena)
  - [Ferramentas da Ordo Realitas](#ferramentas-da-ordo-realitas)
- [Comandos de chat](#comandos-de-chat)
- [Configurações](#configurações)
- [Limites atuais](#limites-atuais)
- [Desenvolvimento](#desenvolvimento)
- [Licença](#licença)

---

## Sobre

_Ordem Paranormal RPG 2_ troca o d20 por uma **escala de dados**. Atributos e perícias valem de
**d4 a d12**, e um teste rola um dado de atributo mais um dado de perícia, somando os dois.

Este módulo implementa essas regras sobre o sistema não-oficial
[Ordem Paranormal](https://github.com/SouOWendel/ordemparanormal_fvtt), **sem substituir nenhuma
classe dele**. O módulo registra o próprio subtipo de Actor, o próprio subtipo de Item, os próprios
modelos de dados, as próprias fichas e a própria classe de rolagem. Uma mesa de OP1 e uma mesa de
OP2 podem coexistir no mesmo mundo, e os dados de OP1 nunca são tocados.

## Status

Versão atual: `0.1.0`

Cobre o escopo completo do **Playtest Alpha**, focado em cenas de investigação. Enquanto o playtest
evoluir, modelos de dados, flags e API interna podem mudar sem compatibilidade retroativa.

## Compatibilidade

- Foundry VTT **v14**
- Sistema **Ordem Paranormal** (`ordemparanormal`) 8.0.0 ou superior

## Instalação

No Foundry, em **Complementos → Módulos → Instalar Módulo**, cole a Manifest URL:

```
https://github.com/MagdielCAS/op2-playtest-alpha/releases/latest/download/module.json
```

Depois ative o módulo em um mundo que use o sistema Ordem Paranormal.

## Recursos principais

| Recurso | O que faz |
|---|---|
| Ficha de agente OP2 | Subtipo de Actor próprio, com 3 atributos e 20 perícias na escala d4–d12, PV, PD, Ímpeto e habilidades. |
| Testes de dois dados | Rola dado de atributo + dado de perícia como uma reserva, soma e compara com a DT. |
| Rolagem alta e baixa | O card de chat mostra a **RA** e a **RB** de cada teste, usadas por várias mecânicas. |
| Passo de dados | Aumentos e reduções de passo em atributos e perícias, integrados aos Active Effects. |
| Críticos | Sucesso crítico com dois dados iguais ≥ 6, e falha crítica com todos os dados em 1. |
| Tabela de falha crítica | Botão no card rola 1d8 e aplica sozinho a redução de atributo ou a perda de PV/PD. |
| Ímpeto | Barra de três espaços do perfil Executor, preenchida na falha e gasta por passo ou por atributo. |
| Ajuda | Oferece aumento de passo a outro personagem, conforme o dado da perícia usada. |
| Pontos de interesse | Subtipo de Item com quadro `Perícia \| DT \| Informação`, desafios de acesso, ferramentas e descrição do mestre. |
| Investigar e Examinar | Investigar revela pelo **valor** da perícia; Examinar rola o teste e cobra 1 PD quando não acha nada novo. |
| Desafios de acesso | Destrancar, Arrombar, Alcançar e Sustentar resolvidos no chat, com estado guardado no ponto. |
| Ferimentos e traumas | Chegar a 0 PV ou 0 PD dispara o teste de Vigor ou Disciplina, com DT que sobe +3 a cada teste. |
| Combate simplificado | Teste oposto de Luta respondido pelo alvo, com Esquiva e dano por RA ou RB. |
| Sobrecarga mental | Dano emocional no fim de cada rodada da investigação, com a progressão do playtest. |
| Recapitular e Compartilhar | Testes DT 10, gastos apenas quando dão certo, uma vez por cena. |
| Ferramentas da Ordo | Laboratório Portátil e Rádio Modificado com as mecânicas próprias do Ato II. |
| Fim de cena | Limpa os efeitos "até o fim da cena", os contadores e as travas de uma vez. |

---

## Como usar

### Criando um agente

Crie um Actor do tipo **Agente (OP2 Playtest)**. A ficha tem três abas.

- **Perícias** — os três atributos no topo e as 20 perícias abaixo. Cada linha mostra o dado da
  perícia e o dado do atributo-base, como na ficha impressa. As seis áreas de **Aptidão** aparecem
  agrupadas, cada uma com o próprio valor.
- **Habilidades** — lista livre de nome, origem e descrição, para as habilidades de perfil e ocupação.
- **História** — biografia e anotações.

No cabeçalho ficam perfil, ocupação, nível, PV, PD e, para o Executor, a barra de Ímpeto.

### Fazendo um teste

Clique no **nome da perícia**. O diálogo permite escolher:

| Campo | Para que serve |
|---|---|
| Atributo | Troca o atributo-base sugerido pela perícia. |
| Passos no atributo / na perícia | Aumentos e reduções de passo (`+1`, `-2`, …). |
| Dado extra | Acrescenta um dado à reserva. |
| Bônus fixo | Soma um valor direto ao total. |
| DT | Dificuldade. **Deixe vazio para um teste sem DT.** |

**Ctrl+clique** rola direto, sem diálogo, contra a DT padrão.

O teste é montado como uma reserva de dados. Acima de três dados a fórmula ganha `kh3`, então a
regra "role no máximo quatro dados e some no máximo três" sai da própria fórmula. Os passos são
aplicados **antes** de montar a fórmula, de modo que o Dice So Nice mostra o dado certo.

O card traz o veredito, os dados usados e a **RA** e a **RB**.

### Críticos e falhas críticas

Dois ou mais dados com o mesmo valor **maior ou igual a 6** são sucesso crítico, e o teste passa
independentemente da DT. Todos os dados em **1** são falha crítica, e o card ganha o botão
**Rolar 1d8**. O resultado é aplicado sozinho quando cabe:

| 1d8 | Efeito | O módulo faz |
|---|---|---|
| 1 | Vexame | Só narra. |
| 2–4 | Machucado / Desatenção / Irritação | Cria um Active Effect de `-1 passo` no atributo. |
| 5–6 | Acidente / Frustração | Rola 1d4 e subtrai de PV ou PD. |
| 7 | Perda | Só narra. |
| 8 | Sem efeito | Nada. |

Os efeitos de passo duram até o fim da cena e são removidos por `/op2cena`.

### Ímpeto do Executor

A barra de três espaços aparece apenas para o perfil **Executor**.

- Uma **falha** em um teste preenche um espaço, automaticamente.
- No diálogo de teste, marque **Ímpeto** para gastar um espaço e ganhar **+1 passo**.
- Com três espaços cheios, o botão de raio ao lado de um atributo gasta os três e cria um efeito de
  **+1 passo** naquele atributo até o fim da cena.

### Ajuda

Digite `/op2ajuda`. Escolha a perícia — d4 não ajuda, d6 ou d8 dá um passo, d10 ou d12 dá dois. O
card vai para o chat e quem for ajudado clica em **Aceitar ajuda**. O bônus fica guardado e é
consumido pelo **próximo teste** daquele personagem.

### Montando uma cena de investigação

Crie um Item do tipo **Ponto de Interesse (OP2)** para cada elemento da cena.

- **Cabeçalho** — nome, número no mapa e a marca de evidência-chave.
- **Informações** — uma linha por entrada do quadro do livro: perícia, qualificador
  (`Humanas`, `apenas Victor`, `apenas com a Câmera`), DT e o texto revelado.
  Deixe a **perícia vazia** para continuar a perícia da linha acima, como o livro imprime.
  O cadeado marca uma linha que só o mestre libera, depois da condição.
  O olho marca uma linha já revelada; **Ocultar tudo** zera as revelações para rodar a cena de novo.
- **Acesso** — as rotas do desafio e o teste disparado pelo ponto (por exemplo, Disciplina DT 10 ao
  ver o cadáver, custando 1 PD na falha).
- **Descrições** — a descrição básica lida em voz alta, a descrição contextual só do mestre e as
  leituras de cada ferramenta da Ordo.

### Jogando a cena de investigação

O mestre abre o ponto e clica em **Enviar ao chat**. O card mostra a descrição básica e um botão por
perícia, **sem as DTs**.

1. O jogador clica em uma perícia. Isso é **Investigar**: o módulo compara as DTs com o **valor do
   dado** que o personagem tem naquela perícia, sem rolagem, e revela o que couber.
2. O card de resultado oferece **Examinar (teste)**. Isso rola o teste e compara as DTs com o
   **total**. Se nada novo aparecer, o personagem perde **1 PD**.
3. O que foi revelado fica guardado no ponto, então é conhecimento do grupo.

> O jogador não precisa de permissão no Item. O módulo resolve tudo no cliente do mestre, então as
> DTs e as linhas ocultas nunca chegam ao navegador dos jogadores.

### Desafios de acesso

Cada rota vira um botão **Tentar** no card do ponto.

| Rota | Como funciona |
|---|---|
| **Destrancar** | O mestre escreve a senha como `4d6` e clica em **Rolar senha**; os números ficam guardados e só ele os vê. O jogador posiciona um número por dado e recebe `baixo`, `exato` ou `alto` para cada um. O card mostra tentativas usadas, restantes e quantas o valor de Crime permite por rodada. Estourar o limite **danifica** a fechadura. |
| **Arrombar** | Custa 1 PV. Teste de Atletismo contra a DT; passando, soma a **RA** à pontuação até alcançar a PA. |
| **Alcançar** | Um diálogo oferece o jeito seguro (duas ações contra a DT, falha causa dano igual à **RB** e recomeça) ou o arriscado (uma ação contra **DT +3**, falha causa dano igual à **RA**). |
| **Sustentar** | Custa 1 PV. Um teste por rodada, com **um passo a menos** para cada rodada já sustentada. |
| **Hack técnico / social** | Aparecem listados no card e são resolvidos pelo mestre na mesa. |

### Ferimentos, traumas e combate

Todo gasto de PV ou PD passa por um único caminho, então **chegar a zero sempre dispara o card** do
teste de sobrevivência: Vigor para PV, Disciplina para PD, contra DT 7 com **+3 por teste já feito**.
Os contadores ficam na ficha e zeram no fim da cena.

Para o combate, `/op2luta` pergunta se você está armado e rola o teste oposto de Luta. O card vai ao
chat com o botão **Responder**, e o alvo escolhe contra-atacar ou **apenas se defender** com
Acrobacia e **+d6**. O vencedor causa dano igual à **RA** se estiver armado, ou à **RB** se estiver
desarmado; quem só se defendeu e venceu não sofre nem causa dano.

### Rodadas, sobrecarga mental e fim de cena

No fim de cada rodada de investigação o mestre digita `/op2rodada`. O contador sobe na cena e todos
os agentes sofrem o dano emocional da progressão do playtest:

| Rodada | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9+ |
|---|---|---|---|---|---|---|---|---|---|
| Dano | 0 | 0 | 1 | 1 | 1d4 | 1d4 | 1d6 | 1d6 | 2d4 |

Quando o dano é uma rolagem, cada personagem rola o próprio.

`/op2recapitular` e `/op2compartilhar` fazem os testes DT 10 das ações de cena. **Só o sucesso**
gasta a ação para o resto da cena.

No fim da cena, `/op2cena` apaga os efeitos "até o fim da cena" criados pelo módulo, zera os
contadores de ferimento e trauma, libera as ações de cena e reinicia o contador de rodadas.

### Ferramentas da Ordo Realitas

Duas ferramentas do Ato II têm mecânica própria e estão automatizadas:

- **`/op2lab <dados>`** — Laboratório Portátil. Rola os dados um a um, começando em d4 e subindo um
  passo a cada rolagem, limitado pelo dado de **Aptidão (Exatas)**. Cada rolagem precisa ser igual ou
  maior que a anterior. O card mostra a sequência, onde ela quebrou e quantas rerrolagens o
  personagem tem (metade de Mente).
- **`/op2radio`** — Rádio Modificado. Teste de Tecnologia: 6 ou menos não remove nada, 7–9 remove
  dois conjuntos falsos, 10–12 remove três, 13 ou mais remove todos.

As demais ferramentas são narrativas — o mestre entrega um handout ou um áudio — e ficam como texto
livre na aba **Descrições** do ponto de interesse.

---

## Comandos de chat

| Comando | O que faz |
|---|---|
| `/op2luta` | Inicia um teste oposto de Luta. |
| `/op2ajuda` | Oferece ajuda a outro personagem. |
| `/op2ferimento` | Rola o teste de Vigor por ferimento, manualmente. |
| `/op2trauma` | Rola o teste de Disciplina por trauma, manualmente. |
| `/op2recapitular` | Ação Recapitular (Intuição DT 10). |
| `/op2compartilhar` | Ação Compartilhar (Pesquisar DT 10). |
| `/op2lab <dados>` | Usa o Laboratório Portátil. |
| `/op2radio` | Usa o Rádio Modificado. |
| `/op2rodada` | **Mestre.** Fecha a rodada e aplica a sobrecarga mental. |
| `/op2cena` | **Mestre.** Fecha a cena e limpa efeitos, contadores e travas. |

Os comandos de jogador usam o token selecionado; sem token, usam o personagem atribuído ao usuário.

## Configurações

| Configuração | Padrão | O que faz |
|---|---|---|
| Permitir passo paranormal (d20) | desligado | Deixa um d12 subir um passo para d20. |
| DT padrão | 7 | Dificuldade usada quando o teste não define outra. |
| Preencher Ímpeto ao falhar | ligado | Preenche um espaço da barra do Executor a cada teste falho. |

## Limites atuais

- **Hack técnico** e **hack social** continuam manuais: os dois terminam em um desafio real na mesa,
  um problema de matemática em 10 segundos e perguntas sobre o dono da senha.
- As habilidades de perfil de **Analista** e **Vigilante** não estão no pacote do playtest, então só
  o Ímpeto do Executor está codificado. A barra é controlada por configuração, então acrescentar
  outro recurso de perfil é uma mudança pequena.
- As ferramentas narrativas da Ordo não têm automação — por natureza, elas entregam um handout.
- O módulo ainda não traz compêndios prontos com os pontos de interesse da missão.

## Desenvolvimento

O módulo é ESM puro, sem build. Os arquivos em `scripts/` são carregados direto pelo Foundry.

```bash
node .github/scripts/validate-manifest.mjs .   # todo caminho declarado no manifesto precisa existir
node .github/scripts/test-rules.mjs            # a aritmética das regras, testada contra o livro
```

Os dois rodam no CI a cada push e de novo **sobre o zip já montado** antes de publicar uma release —
foi assim que a falta de um diretório no pacote deixou de passar despercebida.

A aritmética das regras vive em funções puras, sem importar nada do Foundry, o que permite testá-la
em Node. Vários casos de teste são os exemplos do próprio livro.

```
scripts/config.mjs         todas as constantes e tabelas (CONFIG.OP2)
scripts/socket.mjs         barramento de pedidos ao mestre
scripts/card-actions.mjs   um único listener para os botões dos cards
scripts/chat-commands.mjs  comandos /op2…
scripts/dice/              escala de dados, avaliação, rolagem, diálogo, falha crítica
scripts/data/              modelos de dados do agente e do ponto de interesse
scripts/sheets/            fichas
scripts/investigation/     regras puras + cliente + resolução no mestre
scripts/rules/             sobrevivência, combate, ajuda, sobrecarga, cena
scripts/tools/             ferramentas da Ordo
```

A API pública fica em `game.modules.get("op2-playtest-alpha").api`.

## Licença

MIT. Veja [`LICENSE`](LICENSE).

_Ordem Paranormal_ é uma criação de Rafael "Cellbit" Lange, publicada pela Jambô Editora. Este é um
módulo de fã, não-oficial, e não distribui nenhum conteúdo dos livros.
