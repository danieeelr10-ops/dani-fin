import { useState } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { useFinanzas } from 'src/context/FinanzasContext';
import { useSnackbar } from 'src/context/SnackbarContext';
import { usePWA } from 'src/hooks/usePWA';
import { showNotification, getReminders, toggleReminder } from 'src/utils/notifications';

// ── Constantes de diseño ──────────────────────────────────────
const BG      = '#F7F7F8'
const CARD    = '#FFFFFF'
const CARD_SH = '0 1px 3px rgba(0,0,0,0.07)'
const T1      = '#111318'
const T2      = '#6B7280'
const GREEN   = '#00A76F'
const RED     = '#DC2626'
const BORDER  = '#E5E7EB'

const FIJO_OPTIONS = ['Ingreso', 'Egreso'];
const TIPO_OPTIONS = ['Fijo', 'Variable'];

const inputSx = {
  width: '100%', bgcolor: BG, border: `1px solid ${BORDER}`, borderRadius: '8px',
  px: 1.5, py: 0.75, fontSize: 13, fontFamily: 'inherit', color: T1, outline: 'none',
  boxSizing: 'border-box', '&:focus': { borderColor: GREEN },
}

function ConfigColumn({ title, subtitle, items, onAdd, onDelete, readonly = false }) {
  const [input, setInput] = useState('');

  function handleAdd() {
    const val = input.trim();
    if (!val) return;
    if (items.map(i => i.toLowerCase()).includes(val.toLowerCase())) return;
    onAdd(val); setInput('');
  }

  return (
    <Box sx={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column' }}>
      {/* Header columna */}
      <Box sx={{ px: 2, py: 1.25, bgcolor: '#F9FAFB', borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: T1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: 11, color: T2, mt: 0.2 }}>{subtitle}</Typography>}
      </Box>
      {/* Items */}
      <Box sx={{ flex: 1 }}>
        {items.map(item => (
          <Box key={item} sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, py: 0.875, borderBottom: `1px solid ${BORDER}`,
            '&:hover .del-btn': { opacity: 1 },
          }}>
            <Typography sx={{ fontSize: 13, color: T1 }}>{item}</Typography>
            {!readonly && (
              <Box className="del-btn" onClick={() => onDelete(item)} sx={{
                width: 22, height: 22, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: T2, opacity: 0, transition: 'opacity 0.15s',
                '&:hover': { bgcolor: alpha(RED, 0.08), color: RED },
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </Box>
            )}
          </Box>
        ))}
      </Box>
      {/* Add input */}
      {!readonly && (
        <Box sx={{ px: 1.25, py: 0.875, borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 0.75, alignItems: 'center' }}>
          <Box component="input" placeholder="Agregar..." value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            sx={{ ...inputSx, py: 0.5, fontSize: 12 }} />
          <Box onClick={handleAdd} sx={{
            width: 30, height: 30, borderRadius: '8px', flexShrink: 0, cursor: 'pointer',
            bgcolor: input.trim() ? alpha(GREEN, 0.1) : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
            '&:active': { opacity: 0.7 },
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? GREEN : T2} strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </Box>
        </Box>
      )}
    </Box>
  );
}

const PERFILES = [
  { key: 'fijo',     label: 'Salario fijo',    desc: 'Recibes el mismo monto cada mes',                 icono: '💼' },
  { key: 'variable', label: 'Variable',         desc: 'Tus ingresos cambian cada mes (clientes, etc.)',  icono: '📈' },
  { key: 'mixto',    label: 'Mixto',            desc: 'Tienes ingresos fijos + variables',               icono: '⚡' },
];

export default function Configuracion() {
  const { state, saveConfig, resetAll, savePerfilIngresos, saveNombreUsuario } = useFinanzas();
  const { showSnackbar } = useSnackbar();
  const [nombre, setNombre] = useState(state.nombreUsuario || '');
  const [confirmReset, setConfirmReset] = useState(false);
  const { notifPermission, requestNotifPermission } = usePWA();
  const [reminders, setReminders] = useState(() => getReminders());

  const [egresoFijo,     setEgresoFijo]     = useState([...state.categoriasEgresoFijo]);
  const [egresoVariable, setEgresoVariable] = useState([...state.categoriasEgresoVariable]);
  const [ingreso,        setIngreso]        = useState([...state.categoriasIngreso]);
  const [cuentas,        setCuentas]        = useState([...state.cuentas]);

  function autoSave(ef, ev, ing, cu) {
    saveConfig({ categoriasEgresoFijo: ef, categoriasEgresoVariable: ev, categoriasIngreso: ing, cuentas: cu });
  }

  function addEgresoFijo(v)     { const n = [...egresoFijo, v];           setEgresoFijo(n);     autoSave(n, egresoVariable, ingreso, cuentas); }
  function delEgresoFijo(v)     { const n = egresoFijo.filter(i=>i!==v);  setEgresoFijo(n);     autoSave(n, egresoVariable, ingreso, cuentas); }
  function addEgresoVariable(v) { const n = [...egresoVariable, v];       setEgresoVariable(n); autoSave(egresoFijo, n, ingreso, cuentas); }
  function delEgresoVariable(v) { const n = egresoVariable.filter(i=>i!==v); setEgresoVariable(n); autoSave(egresoFijo, n, ingreso, cuentas); }
  function addIngreso(v)        { const n = [...ingreso, v];              setIngreso(n);        autoSave(egresoFijo, egresoVariable, n, cuentas); }
  function delIngreso(v)        { const n = ingreso.filter(i=>i!==v);     setIngreso(n);        autoSave(egresoFijo, egresoVariable, n, cuentas); }
  function addCuenta(v)         { const n = [...cuentas, v];              setCuentas(n);        autoSave(egresoFijo, egresoVariable, ingreso, n); }
  function delCuenta(v)         { const n = cuentas.filter(i=>i!==v);     setCuentas(n);        autoSave(egresoFijo, egresoVariable, ingreso, n); }

  async function handleRequestPermission() {
    const result = await requestNotifPermission();
    if (result === 'granted') showSnackbar('Notificaciones activadas', 'success');
    else if (result === 'denied') showSnackbar('Permiso denegado en el navegador', 'error');
  }

  function handleToggleReminder(id) {
    toggleReminder(id); setReminders(getReminders());
  }

  return (
    <Box sx={{ bgcolor: BG, minHeight: '100%', pb: 6 }}>
      <Box sx={{ maxWidth: 700, mx: 'auto', px: '20px' }}>

        {/* Header */}
        <Box sx={{ pt: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 22, fontWeight: 600, color: T1, letterSpacing: '-0.3px', lineHeight: 1.2 }}>Configuración</Typography>
          <Typography sx={{ fontSize: 13, color: T2, mt: 0.25 }}>Categorías, cuentas y preferencias · cambios se guardan automáticamente</Typography>
        </Box>

        {/* Perfil financiero */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5, mb: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, mb: 0.5 }}>Perfil</Typography>
          <Typography sx={{ fontSize: 12, color: T2, mb: 1.75 }}>Tu nombre y tipo de ingresos</Typography>

          {/* Nombre */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.5 }}>¿Cómo te llamamos?</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box component="input" type="text" placeholder="Tu nombre" value={nombre}
                onChange={e => setNombre(e.target.value)}
                onBlur={() => { saveNombreUsuario(nombre.trim()); if (nombre.trim()) showSnackbar('Nombre guardado', 'success'); }}
                sx={{ ...inputSx, flex: 1 }} />
            </Box>
          </Box>

          <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 1 }}>Tipo de ingresos</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875 }}>
            {PERFILES.map(p => {
              const sel = (state.perfilIngresos || 'variable') === p.key;
              return (
                <Box key={p.key} onClick={() => savePerfilIngresos(p.key)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.125,
                  borderRadius: '10px', cursor: 'pointer', transition: 'all 0.12s',
                  border: '1px solid', borderColor: sel ? alpha(GREEN, 0.4) : BORDER,
                  bgcolor: sel ? alpha(GREEN, 0.05) : '#FAFAFA',
                  '&:active': { opacity: 0.75 },
                }}>
                  <Typography sx={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{p.icono}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? GREEN : T1, lineHeight: 1.2 }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: 11, color: T2, mt: 0.2 }}>{p.desc}</Typography>
                  </Box>
                  <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${sel ? GREEN : BORDER}`, bgcolor: sel ? GREEN : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
                    {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Tabla de categorías */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, overflow: 'hidden', mb: 3 }}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1 }}>Listas de configuración</Typography>
            <Typography sx={{ fontSize: 12, color: T2, mt: 0.2 }}>Pasa el cursor sobre una fila para eliminar</Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', minWidth: 560, '& > *:not(:last-child)': { borderRight: `1px solid ${BORDER}` } }}>
              <ConfigColumn title="Mov." subtitle="Tipos" items={FIJO_OPTIONS} onAdd={() => {}} onDelete={() => {}} readonly />
              <ConfigColumn title="Egreso fijo" subtitle={`${egresoFijo.length}`} items={egresoFijo}
                onAdd={addEgresoFijo} onDelete={delEgresoFijo} />
              <ConfigColumn title="Eg. variable" subtitle={`${egresoVariable.length}`} items={egresoVariable}
                onAdd={addEgresoVariable} onDelete={delEgresoVariable} />
              <ConfigColumn title="Ingreso" subtitle={`${ingreso.length}`} items={ingreso}
                onAdd={addIngreso} onDelete={delIngreso} />
              <ConfigColumn title="Cuentas" subtitle={`${cuentas.length}`} items={cuentas}
                onAdd={addCuenta} onDelete={delCuenta} />
              <ConfigColumn title="Tipo" subtitle="Clasif." items={TIPO_OPTIONS} onAdd={() => {}} onDelete={() => {}} readonly />
            </Box>
          </Box>
          {/* Stats footer */}
          <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {[
              { label: 'Egreso fijo',     value: egresoFijo.length },
              { label: 'Egreso variable', value: egresoVariable.length },
              { label: 'Ingreso',         value: ingreso.length },
              { label: 'Cuentas',         value: cuentas.length },
            ].map(({ label, value }) => (
              <Typography key={label} sx={{ fontSize: 11, fontWeight: 600, color: T2, bgcolor: '#F3F4F6', px: 1, py: 0.375, borderRadius: '6px' }}>
                {value} {label}
              </Typography>
            ))}
          </Box>
        </Box>

        {/* Notificaciones */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1px solid ${BORDER}`, p: 2.5, mb: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: T1, mb: 0.5 }}>Notificaciones</Typography>
          <Typography sx={{ fontSize: 12, color: T2, mb: 1.75 }}>Recibe recordatorios en tu dispositivo.</Typography>

          {notifPermission === 'granted' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.875, borderRadius: '8px', bgcolor: alpha(GREEN, 0.06), border: `1px solid ${alpha(GREEN, 0.2)}` }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: GREEN, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: GREEN }}>Permiso concedido</Typography>
              </Box>
              <Box component="button" onClick={() => showNotification('Dani Fin · Prueba', 'Las notificaciones funcionan correctamente')}
                sx={{ px: 2, py: 0.875, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T1, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                Enviar notificación de prueba
              </Box>
              {reminders.length > 0 && (
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: T2, mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recordatorios</Typography>
                  {reminders.map(r => (
                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, py: 1, borderRadius: '8px', border: `1px solid ${BORDER}`, mb: 0.75 }}>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: T1 }}>{r.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: T2 }}>
                          {String(r.hour).padStart(2,'0')}:{String(r.minute).padStart(2,'0')} · {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].filter((_,i) => r.days.includes(i)).join(', ')}
                        </Typography>
                      </Box>
                      <Box onClick={() => handleToggleReminder(r.id)} sx={{
                        width: 36, height: 20, borderRadius: '10px', bgcolor: r.enabled ? GREEN : '#D1D5DB',
                        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                      }}>
                        <Box sx={{ position: 'absolute', top: 2, left: r.enabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', bgcolor: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ) : notifPermission === 'denied' ? (
            <Box sx={{ px: 1.5, py: 1.25, borderRadius: '8px', bgcolor: alpha(RED, 0.06), border: `1px solid ${alpha(RED, 0.2)}` }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: RED, mb: 0.25 }}>Permiso bloqueado</Typography>
              <Typography sx={{ fontSize: 11, color: T2 }}>Ve a Configuración del navegador → Permisos del sitio → Notificaciones y actívalas.</Typography>
            </Box>
          ) : (
            <Box component="button" onClick={handleRequestPermission}
              sx={{ px: 2, py: 0.875, borderRadius: '8px', border: 'none', bgcolor: T1, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
              Activar notificaciones
            </Box>
          )}
        </Box>

        {/* Zona de peligro */}
        <Box sx={{ bgcolor: CARD, borderRadius: '16px', boxShadow: CARD_SH, border: `1.5px solid ${alpha(RED, 0.25)}`, p: 2.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: RED, mb: 0.5 }}>Zona de peligro</Typography>
          <Typography sx={{ fontSize: 12, color: T2, mb: 1.5 }}>
            Borra todas las transacciones, mercado y presupuestos. Conserva categorías y cuentas.
          </Typography>
          {!confirmReset ? (
            <Box component="button" onClick={() => setConfirmReset(true)} sx={{
              px: 2, py: 0.875, borderRadius: '8px', border: `1.5px solid ${alpha(RED, 0.35)}`,
              bgcolor: alpha(RED, 0.06), color: RED, fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              Resetear todo
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: RED }}>¿Seguro? No se puede deshacer.</Typography>
              <Box component="button" onClick={() => { resetAll(); setConfirmReset(false); showSnackbar('Datos eliminados', 'success'); }}
                sx={{ px: 2, py: 0.75, borderRadius: '8px', border: 'none', bgcolor: RED, color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Sí, borrar todo
              </Box>
              <Box component="button" onClick={() => setConfirmReset(false)}
                sx={{ px: 2, py: 0.75, borderRadius: '8px', border: `1px solid ${BORDER}`, bgcolor: 'transparent', color: T2, fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancelar
              </Box>
            </Box>
          )}
        </Box>

      </Box>
    </Box>
  );
}
