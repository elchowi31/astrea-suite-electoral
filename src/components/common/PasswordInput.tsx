import React, { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** La contraseña permanece oculta inicialmente; mostrarla no cambia ni guarda su valor. */
export function PasswordInput({className = '', style, ...props}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible,setVisible] = useState(false);
  return <div className="relative">
    <input {...props} type={visible ? 'text' : 'password'} className={`min-h-11 ${className}`} style={{...style,paddingRight:'6.5rem'}} />
    <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={visible}
      onMouseDown={event=>event.preventDefault()} onClick={()=>setVisible(value=>!value)}
      className="absolute inset-y-0 right-1 flex min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-cyan-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400">
      {visible ? <EyeOff className="h-4 w-4" aria-hidden="true"/> : <Eye className="h-4 w-4" aria-hidden="true"/>}
      {visible ? 'Ocultar' : 'Mostrar'}
    </button>
  </div>;
}
