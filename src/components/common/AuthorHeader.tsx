import React from 'react';
interface AuthorHeaderProps {title?:string;subtitle?:string;badgeText?:string}
export const AuthorHeader:React.FC<AuthorHeaderProps>=({title='Astrea Suite Electoral',subtitle})=><header className="module-heading"><div><h1>{title}</h1>{subtitle&&<details className="compact-disclosure"><summary>Acerca de esta sección</summary><p>{subtitle}</p></details>}</div></header>;
