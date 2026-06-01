export type BankSeed = {
  ibpCode: string;
  name: string;
  shortName: string;
  c2pEnabled: boolean;
  transferEnabled: boolean;
};

export const VENEZUELAN_BANKS: BankSeed[] = [
  { ibpCode: '0102', name: 'Banco de Venezuela', shortName: 'BDV', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0104', name: 'Venezolano de Crédito', shortName: 'VC', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0105', name: 'Banco Mercantil', shortName: 'Mercantil', c2pEnabled: true, transferEnabled: true },
  {
    ibpCode: '0108',
    name: 'Banco Provincial (BBVA)',
    shortName: 'Provincial',
    c2pEnabled: true,
    transferEnabled: true,
  },
  { ibpCode: '0114', name: 'Bancaribe', shortName: 'Bancaribe', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0115', name: 'Banco Exterior', shortName: 'Exterior', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0116', name: 'Banco Occidental de Descuento', shortName: 'BOD', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0128', name: 'Banco Caroní', shortName: 'Caroní', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0134', name: 'Banesco', shortName: 'Banesco', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0137', name: 'Banco Sofitasa', shortName: 'Sofitasa', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0138', name: 'Banco Plaza', shortName: 'Plaza', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0151', name: 'BFC Banco Fondo Común', shortName: 'BFC', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0156', name: '100% Banco', shortName: '100%', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0157', name: 'DelSur Banco Universal', shortName: 'DelSur', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0163', name: 'Banco del Tesoro', shortName: 'Tesoro', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0166', name: 'Banco Agrícola de Venezuela', shortName: 'BAV', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0168', name: 'Bancrecer', shortName: 'Bancrecer', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0169', name: 'Mi Banco', shortName: 'Mi Banco', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0171', name: 'Banco Activo', shortName: 'Activo', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0172', name: 'Bancamiga', shortName: 'Bancamiga', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0174', name: 'Banplus', shortName: 'Banplus', c2pEnabled: true, transferEnabled: true },
  { ibpCode: '0175', name: 'Banco Bicentenario', shortName: 'Bicentenario', c2pEnabled: true, transferEnabled: true },
  {
    ibpCode: '0177',
    name: 'Banco de la Fuerza Armada Nacional Bolivariana',
    shortName: 'BANFANB',
    c2pEnabled: true,
    transferEnabled: true,
  },
  { ibpCode: '0191', name: 'Banco Nacional de Crédito', shortName: 'BNC', c2pEnabled: true, transferEnabled: true },
];
