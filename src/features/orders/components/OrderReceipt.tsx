import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { ArtImage } from '@/features/catalog/components/ArtImage'
import { CONNECTOR_LABELS, NETWORK_LABELS } from '@/features/checkout/form'
import type { Order } from '@/shared/contracts'
import { formatDate, formatDiscount, formatEth, shortHash } from '@/shared/lib/format'
import { compare } from '@/shared/lib/money'
import { buttonVariants } from '@/shared/ui/button'
import { explorerLinkLabel } from '../explorer'

/** The Figma envelope with its "THANK YOU" card, drawn inline (no extra request). */
function EnvelopeIcon() {
  const label = { textAnchor: 'middle', fill: 'currentColor', stroke: 'none', fontSize: 15, fontWeight: 800 } as const
  return (
    <svg aria-hidden viewBox="0 0 96 120" className="h-24 w-20 text-primary" fill="none" stroke="currentColor">
      <path d="M40 8 a8 6 0 0 1 16 0" strokeWidth="3" />
      <rect x="12" y="8" width="72" height="56" rx="4" strokeWidth="3" />
      <text x="48" y="30" {...label}>
        THANK
      </text>
      <text x="48" y="48" {...label}>
        YOU
      </text>
      <path d="M4 52 v60 h88 v-60" strokeWidth="3" strokeLinejoin="round" />
      <path d="M4 52 l8 -6 M92 52 l-8 -6" strokeWidth="3" strokeLinecap="round" />
      <path d="M4 112 l34 -34 q10 -9 20 0 l34 34" strokeWidth="3" strokeLinejoin="round" />
      <path d="M4 56 l26 22 M92 56 l-20 17 M76 96 l8 8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const tokenId = (tokenNumber: number) => `#${String(tokenNumber).padStart(4, '0')}`

/**
 * Receipt of a confirmed order (Figma "Confirmação de Pedido"). Every amount, item and the wallet come
 * ONLY from the immutable `order.snapshot`: later price or stock changes never alter it.
 */
export function OrderReceipt({ order }: { order: Order }) {
  const { snapshot } = order
  const network = NETWORK_LABELS[snapshot.network]
  return (
    <section
      aria-labelledby="receipt-title"
      className="relative mx-auto flex w-full max-w-[700px] flex-col border-b-[10px] border-primary bg-surface"
    >
      <Link
        to="/"
        aria-label="Fechar"
        className="absolute top-3 right-3 inline-flex size-10 items-center justify-center rounded-md text-primary hover:bg-primary/10"
      >
        <X aria-hidden className="size-5" />
      </Link>

      <header className="flex flex-col items-center gap-4 px-6 py-6">
        <EnvelopeIcon />
        <h1 id="receipt-title" className="text-center text-body-lg-16 leading-6 font-bold text-text-secondary">
          Seus NFTs agora estão na sua carteira
        </h1>
      </header>

      <dl className="grid grid-cols-2 gap-y-4 border-y border-primary px-6 py-4 text-body-15 leading-5 sm:grid-cols-4 [&_dt]:text-body-14 sm:gap-y-0 sm:px-10">
        <div className="pr-3 sm:border-r sm:border-primary">
          <dt className="font-bold text-text-secondary">ID da transação</dt>
          <dd className="text-text-secondary">{shortHash(order.txHash)}</dd>
        </div>
        <div className="pl-3 sm:border-r sm:border-primary sm:px-4">
          <dt className="text-text-secondary">Data</dt>
          <dd className="text-text-secondary">{formatDate(order.resolvedAt ?? order.createdAt)}</dd>
        </div>
        <div className="pr-3 sm:border-r sm:border-primary sm:px-4">
          <dt className="text-text-secondary">Total</dt>
          <dd data-testid="receipt-summary-total" className="text-text-secondary">
            {formatEth(snapshot.total)}
          </dd>
        </div>
        <div className="min-w-0 pl-3 sm:pl-4">
          <dt className="font-bold text-text-secondary">Carteira</dt>
          <dd data-testid="receipt-wallet" className="text-text-secondary">
            {CONNECTOR_LABELS[snapshot.connector]}
            <span className="block text-caption-13 leading-5 break-words">{snapshot.walletLabel}</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-4 px-4 pt-6 pb-10 sm:px-14">
        <h2 className="text-body-15 font-bold text-foreground">Detalhes da transação</h2>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">NFTs comprados</caption>
          <thead>
            <tr className="border-b border-border-strong text-body-15 text-foreground sm:text-body-lg-16">
              <th scope="col" className="pb-3 font-bold">
                NFTs
              </th>
              <th scope="col" className="px-2 pb-3 text-center font-bold">
                Edições
              </th>
              <th scope="col" className="pb-3 text-right font-medium">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshot.lines.map((line) => (
              <tr key={`${line.nftId}:${line.editionId}`} data-testid="receipt-line">
                <td className="py-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <ArtImage
                      art={line.art}
                      sizes="64px"
                      alt=""
                      className="size-12 shrink-0 rounded-md object-cover sm:size-16"
                    />
                    <div className="min-w-0">
                      <p className="text-body-15 font-bold break-words text-foreground sm:text-body-lg-16">{line.name}</p>
                      <p className="text-caption-13 leading-5 text-muted sm:text-body-14">ID do token: {tokenId(line.tokenNumber)}</p>
                      <p className="sr-only">Edição {line.editionLabel}</p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-center text-body-14 whitespace-nowrap text-text-secondary">
                  (x {line.quantity})
                </td>
                <td
                  data-testid="receipt-line-total"
                  className="py-2 text-right text-body-15 font-bold whitespace-nowrap text-text-accent sm:text-body-lg-18"
                >
                  {formatEth(line.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto flex w-full max-w-[400px] flex-col gap-2 border-b border-border-strong pb-3 text-body-15">
          {compare(snapshot.discount, '0') > 0 && (
            <div className="flex justify-between gap-4 text-foreground">
              <dt>Desconto</dt>
              <dd>{formatDiscount(snapshot.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 text-foreground">
            <dt>Taxa de rede</dt>
            <dd className="text-body-lg-18">{formatEth(snapshot.networkFee, { minDecimals: 3 })}</dd>
          </div>
          <div className="flex justify-between gap-4 font-bold">
            <dt className="text-body-lg-16 text-foreground">Total</dt>
            <dd data-testid="receipt-total" className="text-body-lg-18 text-text-accent">
              {formatEth(snapshot.total)}
            </dd>
          </div>
        </dl>

        <p className="mx-auto max-w-[560px] text-center text-body-14 leading-6 text-text-secondary">
          Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada
          na rede.
        </p>
        <a
          href={order.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ size: 'lg', className: 'self-center text-body-lg-16' })}
        >
          {explorerLinkLabel(snapshot.network)}
          <span className="sr-only"> (simulação, abre em nova aba)</span>
        </a>
      </div>
    </section>
  )
}
