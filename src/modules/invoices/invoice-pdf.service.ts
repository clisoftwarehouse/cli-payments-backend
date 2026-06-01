import pdfmake from 'pdfmake';
import { Logger, Injectable, OnModuleInit } from '@nestjs/common';
import type { TFontDictionary, TDocumentDefinitions } from 'pdfmake/interfaces';

import { Invoice } from './domain/invoice';
import { Customer } from '@/modules/customers/domain/customer';
import { Application } from '@/modules/applications/domain/application';

@Injectable()
export class InvoicePdfService implements OnModuleInit {
  private readonly logger = new Logger(InvoicePdfService.name);

  onModuleInit(): void {
    // Helvetica es una de las 14 fuentes PDF estándar; PDFKit la resuelve sin requerir TTF.
    const fonts: TFontDictionary = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    pdfmake.setFonts(fonts);
  }

  async generate(invoice: Invoice, customer: Customer, application: Application): Promise<Buffer> {
    const isPaid = invoice.status === 'paid';

    const def: TDocumentDefinitions = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageSize: 'LETTER',
      pageMargins: [50, 60, 50, 60],
      info: {
        title: invoice.number ?? `Recibo ${invoice.id}`,
        author: 'CLI Software House',
      },
      content: [
        {
          columns: [
            [
              { text: 'CLI Software House', style: 'brand' },
              { text: 'clisoftwarehouse.com · info@clisoftwarehouse.com', style: 'muted' },
            ],
            [
              { text: isPaid ? 'RECIBO DE PAGO' : 'COBRO PENDIENTE', style: 'title', alignment: 'right' },
              { text: invoice.number ?? '— sin número (draft) —', style: 'number', alignment: 'right' },
              { text: `Emitido: ${this.fmtDate(invoice.createdAt)}`, style: 'muted', alignment: 'right' },
              ...(invoice.paidAt
                ? [{ text: `Pagado: ${this.fmtDate(invoice.paidAt)}`, style: 'paid', alignment: 'right' as const }]
                : []),
            ],
          ],
        },
        { text: '', margin: [0, 10, 0, 10] },
        {
          columns: [
            [
              { text: 'Aplicación', style: 'label' },
              { text: application.name, style: 'value' },
              { text: `slug: ${application.slug}`, style: 'muted' },
            ],
            [
              { text: 'Cliente', style: 'label' },
              { text: customer.fullName, style: 'value' },
              { text: customer.email, style: 'muted' },
              ...(customer.identityValue
                ? [
                    {
                      text: `${customer.identityType?.toUpperCase() ?? 'ID'}: ${customer.identityValue}`,
                      style: 'muted',
                    },
                  ]
                : []),
            ],
          ],
          columnGap: 30,
        },
        { text: '', margin: [0, 15, 0, 0] },
        {
          table: {
            widths: ['*', 50, 80, 80],
            headerRows: 1,
            body: [
              [
                { text: 'Descripción', style: 'tableHeader' },
                { text: 'Cant.', style: 'tableHeader', alignment: 'right' },
                { text: `Unit. (${invoice.displayCurrency})`, style: 'tableHeader', alignment: 'right' },
                { text: `Total (${invoice.displayCurrency})`, style: 'tableHeader', alignment: 'right' },
              ],
              ...invoice.items.map((it) => [
                { text: it.description },
                { text: it.quantity.toString(), alignment: 'right' as const },
                { text: this.fmtMoney(it.unitAmountEur), alignment: 'right' as const },
                { text: this.fmtMoney(it.lineTotalEur), alignment: 'right' as const },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        { text: '', margin: [0, 15, 0, 0] },
        {
          columns: [
            { text: '' },
            {
              table: {
                widths: ['*', 80],
                body: [
                  [
                    { text: `Total ${invoice.displayCurrency}`, style: 'totalLabel' },
                    { text: this.fmtMoney(invoice.displayAmount), style: 'totalAmount', alignment: 'right' },
                  ],
                  ...(invoice.chargedCurrency && invoice.chargedAmount
                    ? [
                        [
                          { text: `Equiv. ${invoice.chargedCurrency}`, style: 'subTotalLabel' },
                          {
                            text: this.fmtMoney(invoice.chargedAmount),
                            style: 'subTotal',
                            alignment: 'right' as const,
                          },
                        ],
                      ]
                    : []),
                ],
              },
              layout: 'noBorders',
              width: 220,
            },
          ],
          columnGap: 0,
        },
        ...(invoice.fxRateUsed
          ? [
              {
                text: `Tasa de cambio aplicada: 1 ${invoice.displayCurrency} = ${this.fmtMoney(invoice.fxRateUsed)} ${invoice.chargedCurrency} (${invoice.fxRateSource}, ${invoice.fxRateDate}).`,
                style: 'muted',
                margin: [0, 12, 0, 0] as [number, number, number, number],
              },
            ]
          : []),
        ...(invoice.notes
          ? [{ text: invoice.notes, style: 'muted', margin: [0, 15, 0, 0] as [number, number, number, number] }]
          : []),
        {
          text: 'Recibo generado por CLI Payments. Documento sin valor fiscal (no homologado SENIAT).',
          style: 'footer',
          absolutePosition: { x: 50, y: 760 },
        },
      ],
      styles: {
        brand: { fontSize: 14, bold: true },
        title: { fontSize: 16, bold: true, color: isPaid ? '#16a34a' : '#0f172a' },
        number: { fontSize: 11, bold: true, color: '#0f172a' },
        label: { fontSize: 8, color: '#64748b', characterSpacing: 1 },
        value: { fontSize: 11, bold: true, color: '#0f172a' },
        muted: { fontSize: 9, color: '#64748b' },
        paid: { fontSize: 10, bold: true, color: '#16a34a' },
        tableHeader: { fontSize: 9, bold: true, fillColor: '#f1f5f9', color: '#0f172a' },
        totalLabel: { fontSize: 11, bold: true },
        totalAmount: { fontSize: 13, bold: true },
        subTotalLabel: { fontSize: 10, color: '#64748b' },
        subTotal: { fontSize: 11, color: '#64748b' },
        footer: { fontSize: 8, color: '#94a3b8' },
      },
    };

    return pdfmake.createPdf(def).getBuffer();
  }

  private fmtMoney(value: string): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private fmtDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('es-VE', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
}
