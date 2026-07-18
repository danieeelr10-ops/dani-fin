export const MESES = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'];
export const MES_NAMES = ['Enero','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export const CAT_ICONS = {
  Mercado:'🛒', Transporte:'🚗', Salidas:'🍕', Salud:'💊', Hogar:'🏠',
  Entretenimiento:'🎬', Educacion:'📚', Vacaciones:'✈️', Regalos:'🎁',
  Extras:'📦', Vehiculos:'🚙', Familia:'👨‍👩‍👧', Trabajo:'💼', 'Trabajo extra':'💼',
  Inversion:'📈', Ahorro:'💰', Sueldo:'💵',
  // Ingresos variables
  Clientes:'🤝', Freelance:'💻', Comisiones:'💸', Negocios:'🏪',
  Arriendo:'🏘️', 'Otros ingresos':'💰',
};

export const CAT_COLORS = {
  Hogar:'#60a5fa', Mercado:'#fbbf24', Salidas:'#f87171', Entretenimiento:'#a78bfa',
  Extras:'#7c7f9e', Familia:'#34d399', Salud:'#fb923c', Vehiculos:'#94a3b8',
  Trabajo:'#6c63ff', 'Trabajo extra':'#6c63ff', Regalos:'#f472b6', Vacaciones:'#2dd4bf',
  Transporte:'#a3e635', Ahorro:'#60a5fa', Inversion:'#a78bfa',
};

// Egresos que típicamente se repiten igual cada mes
export const CATEGORIAS_EGRESO_FIJO = [
  'Hogar','Salud','Familia','Trabajo','Entretenimiento','Inversion','Ahorro',
];
// Egresos que varían mes a mes
export const CATEGORIAS_EGRESO_VARIABLE = [
  'Mercado','Transporte','Salidas','Educacion','Vacaciones','Regalos','Extras','Vehiculos',
];
// Lista combinada (usada donde no importa el tipo)
export const CATEGORIAS_EGRESO = [...CATEGORIAS_EGRESO_FIJO, ...CATEGORIAS_EGRESO_VARIABLE];
export const CATEGORIAS_INGRESO = [
  'Sueldo', 'Clientes', 'Freelance', 'Comisiones', 'Negocios',
  'Trabajo extra', 'Arriendo', 'Otros ingresos',
];
export const CUENTAS = ['Nequi','T.C','Daviplata','Nu','Efectivo'];

export const DEFAULT_METAS = {
  M1:{ahorro:0,inversion:0}, M2:{ahorro:0,inversion:0},
  M3:{ahorro:0,inversion:0}, M4:{ahorro:0,inversion:0},
  M5:{ahorro:0,inversion:0}, M6:{ahorro:0,inversion:0},
  M7:{ahorro:0,inversion:0}, M8:{ahorro:0,inversion:0},
  M9:{ahorro:0,inversion:0}, M10:{ahorro:0,inversion:0},
  M11:{ahorro:0,inversion:0}, M12:{ahorro:0,inversion:0},
};

export const DEFAULT_PRESUPUESTO = {};

export const DEFAULT_INVERSIONES = [];

// ── Voz ──────────────────────────────────────────────────
export const PALABRAS_RUIDO = /\b(pague|pagar|gaste|gasté|compre|compré|pedí|pedi|fui|comi|almorcé|cene|cené|me cobro|me cobró|me cargaron|cargue|cargué|hay que|queda|quedo|quedó|le di|le pague|le pagué|le mande|mandé|puse|guarde|guardé|consigné|saque|saqué|ingreso|ingresó|recibí|recibi|me pagaron|me entraron|entraron|llego|llegó|abonaron|con la|con el|con mi|desde|para|en el|en la|en los|en las|al|a la|a los|por|del|de la|de los|hoy|ayer|esta mañana|esta tarde|el|la|los|las|un|una|que|como|pero|y|o|de|a)\b/gi;

export const CATEGORIAS_VOZ = {
  mercado:'Mercado', supermercado:'Mercado', exito:'Mercado', ara:'Mercado',
  jumbo:'Mercado', d1:'Mercado', sprint:'Mercado', alkosto:'Mercado',
  olimpica:'Mercado', tienda:'Mercado', panaderia:'Mercado', frutas:'Mercado',
  transporte:'Transporte', taxi:'Transporte', uber:'Transporte', bus:'Transporte',
  sitp:'Transporte', metro:'Transporte', indriver:'Transporte', cabify:'Transporte',
  salidas:'Salidas', restaurante:'Salidas', comida:'Salidas', almuerzo:'Salidas',
  cena:'Salidas', rappi:'Salidas', domicilio:'Salidas', burger:'Salidas',
  pizza:'Salidas', mcdonald:'Salidas', kfc:'Salidas', frisby:'Salidas',
  cerveza:'Salidas', bar:'Salidas', rumba:'Salidas', cafe:'Salidas',
  starbucks:'Salidas', 'juan valdez':'Salidas', tinto:'Salidas',
  salud:'Salud', farmacia:'Salud', medico:'Salud', drogueria:'Salud',
  compensar:'Salud', clinica:'Salud', hospital:'Salud', cita:'Salud', medicina:'Salud',
  hogar:'Hogar', arriendo:'Hogar', internet:'Hogar', luz:'Hogar', gas:'Hogar',
  agua:'Hogar', servicios:'Hogar', claro:'Hogar', movistar:'Hogar', tigo:'Hogar',
  celular:'Hogar', telefono:'Hogar',
  entretenimiento:'Entretenimiento', cine:'Entretenimiento', netflix:'Entretenimiento',
  spotify:'Entretenimiento', disney:'Entretenimiento', juego:'Entretenimiento',
  educacion:'Educacion', curso:'Educacion', universidad:'Educacion', udemy:'Educacion',
  platzi:'Educacion', libro:'Educacion',
  vacaciones:'Vacaciones', viaje:'Vacaciones', hotel:'Vacaciones', vuelo:'Vacaciones',
  regalos:'Regalos', regalo:'Regalos', detalle:'Regalos',
  extras:'Extras', amazon:'Extras',
  vehiculos:'Vehiculos', carro:'Vehiculos', moto:'Vehiculos', gasolina:'Vehiculos',
  parqueadero:'Vehiculos', peaje:'Vehiculos', taller:'Vehiculos',
  familia:'Familia', papa:'Familia', mama:'Familia', hermano:'Familia', hermana:'Familia',
  trabajo:'Trabajo', canva:'Trabajo', capcut:'Trabajo', adobe:'Trabajo',
  suscripcion:'Trabajo', dominio:'Trabajo', hosting:'Trabajo',
  inversion:'Inversion', acciones:'Inversion', crypto:'Inversion', bitcoin:'Inversion',
  ahorro:'Ahorro', ahorrar:'Ahorro', alcancia:'Ahorro',
  sueldo:'Sueldo', salario:'Sueldo', quincena:'Sueldo', vittoria:'Sueldo',
  'trabajo extra':'Trabajo extra', proyecto:'Trabajo extra',
  freelance:'Freelance', contrato:'Freelance', desarrollo:'Freelance',
  cliente:'Clientes', clientes:'Clientes', sesion:'Clientes', sesiones:'Clientes',
  cobro:'Clientes', factura:'Clientes', pago:'Clientes', honorarios:'Clientes',
  comision:'Comisiones', comisiones:'Comisiones', venta:'Comisiones', ventas:'Comisiones',
  negocio:'Negocios', negocio:'Negocios', emprendimiento:'Negocios',
  arriendo:'Arriendo', alquiler:'Arriendo', canon:'Arriendo',
};

export const CUENTAS_VOZ = {
  nequi:'Nequi', 'tarjeta de credito':'T.C', 'tarjeta credito':'T.C',
  credito:'T.C', tc:'T.C', tarjeta:'T.C', visa:'T.C', mastercard:'T.C',
  daviplata:'Daviplata', davivienda:'Daviplata',
  nu:'Nu', nubank:'Nu',
  efectivo:'Efectivo', cash:'Efectivo', billete:'Efectivo',
};

export const NUMS_ES = {
  cero:0, un:1, uno:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
  diez:10, once:11, doce:12, trece:13, catorce:14, quince:15,
  dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
  veinte:20, veintiuno:21, veintidos:22, veintitres:23, veinticuatro:24,
  veinticinco:25, veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29,
  treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90,
  cien:100, ciento:100,
  doscientos:200, trescientos:300, cuatrocientos:400, quinientos:500,
  seiscientos:600, setecientos:700, ochocientos:800, novecientos:900,
};
