# Lista cerrada y ejemplo ASI de 1.400 votos

Fecha de revisión: 18 de noviembre de 2026.

Una lista cerrada o sin voto preferente recibe votos por la lista. Sus curules se entregan según el orden de inscripción de sus aspirantes. En una lista abierta, los votos preferentes determinan el orden de los candidatos; los votos solo por el partido contribuyen al total de la lista. Un empate que afecte la adjudicación necesita el procedimiento oficial de desempate.

El tipo de lista no concede un umbral distinto ni una cifra repartidora especial: ambas modalidades compiten por curules con la misma regla de la corporación. En un Concejo con más de dos curules se calcula el umbral del 50% del cociente electoral y se aplica cifra repartidora a las listas habilitadas. Los votos en blanco integran los votos válidos para este cálculo; los nulos y no marcados se excluyen. Véase la [Circular Única Electoral v4, apartados 39.15.1 a 39.15.2, páginas 245–249](https://www.registraduria.gov.co/IMG/pdf/20240708_circular-unica-electoral_v4.pdf).

## El escenario incorporado al simulador

**1.400 votos por sí solos no permiten determinar las curules.** También se necesitan los votos de las demás listas, blancos, número de curules y reglas de la corporación. El botón «Simular lista cerrada · ejemplo ASI» carga este supuesto didáctico, editable. No afirma que ASI haya inscrito una lista cerrada ni que estos sean resultados reales de Astrea.

| Parámetro | Valor del supuesto |
|---|---:|
| Curules a repartir | 11 |
| Votos válidos | 10.000 |
| Votos en blanco | 400 |
| Votos sumados de las listas | 9.600 |
| ASI, supuesta lista cerrada | 1.400 |
| Lista A | 2.600 |
| Lista B | 2.300 |
| Lista C | 1.800 |
| Lista D | 900 |
| Lista E | 600 |

Cociente: 10.000 ÷ 11 = 909,09. Mitad del cociente: 454,55. El primer voto entero que alcanza esa referencia es 455. Todas las listas del ejemplo la alcanzan.

Los once mayores resultados de dividir los votos de cada lista por 1, 2, 3… son:

| Orden | Lista | División | Resultado |
|---|---|---|---:|
| 1 | A | 2.600 ÷ 1 | 2.600 |
| 2 | B | 2.300 ÷ 1 | 2.300 |
| 3 | C | 1.800 ÷ 1 | 1.800 |
| 4 | ASI | 1.400 ÷ 1 | 1.400 |
| 5 | A | 2.600 ÷ 2 | 1.300 |
| 6 | B | 2.300 ÷ 2 | 1.150 |
| 7–8 | C y D | 1.800 ÷ 2 y 900 ÷ 1 | 900 cada una |
| 9 | A | 2.600 ÷ 3 | 866,67 |
| 10 | B | 2.300 ÷ 3 | 766,67 |
| 11 | ASI | 1.400 ÷ 2 | 700 |

La cifra repartidora es **700**. El empate de 900 no afecta el corte, porque ambas posiciones están dentro de las once curules.

| Lista | Curules en este supuesto |
|---|---:|
| A | 3 |
| B | 3 |
| C | 2 |
| ASI | **2** |
| D | 1 |
| E | 0 |
| Total | 11 |

**ASI obtendría dos curules en este escenario.** Como se configuró cerrada, corresponderían a sus aspirantes inscritos en los puestos 1 y 2. Si se cambia únicamente a lista abierta, manteniendo los mismos totales de las listas, ASI conserva las dos curules; cambia quiénes las ocupan según los votos preferentes. El simulador permite editar aspirantes y sus votos para comparar ambas modalidades.

Cambiar los votos de otras listas, blancos o número de curules puede cambiar el resultado de ASI, aunque mantenga sus 1.400 votos. La simulación muestra ese resultado condicionado a los supuestos, junto con su método y matriz de divisiones.

## Alcance

El ejemplo supone once puestos disponibles para reparto ordinario y suficientes aspirantes habilitados. Para representar una elección concreta deben confirmarse año, corporación, curules efectivamente disponibles, listas inscritas, votación escrutada y decisiones de la autoridad electoral, incluida la aplicación que corresponda del Estatuto de la Oposición. La app no certifica una elección ni decide sorteos oficiales.

Para Senado la referencia ordinaria es 3% de votos válidos; la excepción constitucional de dos curules usa cociente y residuos y exige superar 30% del cociente. Si ninguna lista alcanza la referencia aplicable, el modelo contempla el reparto excepcional entre participantes. Estas reglas se distinguen de la modalidad abierta o cerrada. Fuente: [Registraduría, Circular Única Electoral](https://www.registraduria.gov.co/Circular-unica-electoral.html).
