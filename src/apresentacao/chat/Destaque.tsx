"use client";

import { useEffect } from "react";

/**
 * Leva o painel destacado até a vista (RF-13, seção 6.5).
 *
 * *"O painel citado fica visível sem rolagem manual."* O servidor marca o
 * painel — contorno, sombra e rótulo — e só o navegador pode rolar até ele.
 * Este componente não desenha nada: monta, rola, e pronto.
 *
 * Vale para quem chegou pelo chat e para quem colou uma URL com `painel=`:
 * nos dois casos o painel está na página quando este efeito roda, porque a
 * página o renderiza no mesmo envio.
 *
 * A página monta este componente com uma chave que muda a cada URL. Sem isso,
 * duas perguntas seguidas sobre o mesmo painel não rolariam na segunda — o
 * efeito não reexecuta para a mesma propriedade.
 */
export function Destaque({ painel }: { readonly painel: string | null }) {
  useEffect(() => {
    if (painel !== null) rolarAte(painel);
  }, [painel]);

  return null;
}

/**
 * Rola até o painel de id dado, se ele estiver na página.
 *
 * Exportada porque o chat também precisa dela: quando a resposta cita a tela
 * e o recorte em que a pessoa já está, não há navegação para remontar
 * `Destaque`, e é o chat quem rola.
 */
export function rolarAte(painel: string): void {
  // O seletor nomeia a moldura de propósito: a página também carrega o id
  // do painel destacado num `<dl>` escondido, e um seletor só por `data-painel`
  // encontrava esse `<dl>` primeiro — e rolava até um elemento sem altura.
  const alvo = document.querySelector<HTMLElement>(
    `[data-teste="painel"][data-painel="${CSS.escape(painel)}"]`,
  );
  if (alvo === null) return;
  const reduzido = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  alvo.scrollIntoView({
    block: "center",
    behavior: reduzido ? "auto" : "smooth",
  });
}
