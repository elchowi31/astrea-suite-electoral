import React,{createContext,useContext} from 'react';
const WriteAccess=createContext(true);
export function WriteAccessProvider({role,children}:{role:string;children:React.ReactNode}){return <WriteAccess.Provider value={!['Consulta','Invitado'].includes(role)}>{children}</WriteAccess.Provider>;}
export const useFormWriteAccess=()=>useContext(WriteAccess);
