import { CampaignCoordination, GrassrootsVoter, CampaignTask } from '../types';

export const INITIAL_CAMPAIGN_COORDINATIONS: CampaignCoordination[] = [
  {
    id: 'coord-politica',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación Política',
    coordinatorName: 'Bernardo Palmezano',
    coordinatorRole: 'Coordinador Político General & Enlace Territorial',
    coordinatorPhone: '+57 310 445 6789',
    coordinatorEmail: 'bernardo.palmezano@campana2026.org',
    color: '#2563eb', // Blue
    iconName: 'Users',
    summary: 'Articulación de alianzas con partidos políticos, diálogo con jefes de debate, análisis de encuestas y movilización cívica ciudadana.',
    committees: [
      {
        id: 'com-pol-1',
        coordinationId: 'coord-politica',
        name: 'Comité de Relaciones con Partidos Políticos y Líderes Locales',
        leadPerson: 'Bernardo Palmezano',
        responsibilities: [
          'Establecer y mantener relaciones sólidas con partidos políticos y líderes locales.',
          'Organizar reuniones y diálogos con representantes políticos para discutir estrategias y obtener apoyo.',
          'Organizar temas de discusión para el jefe de debate.'
        ],
        tasksCount: 6,
        completedTasksCount: 4,
        status: 'En Ejecución',
        membersCount: 8
      },
      {
        id: 'com-pol-2',
        coordinationId: 'coord-politica',
        name: 'Comité de Análisis de Opinión Pública y Encuestas',
        leadPerson: 'Lic. Andrés Cardozo',
        responsibilities: [
          'Realizar estudios de opinión pública y análisis de encuestas para comprender las tendencias y preferencias electorales.',
          'Utilizar los datos recopilados para orientar las estrategias de la campaña y tomar decisiones informadas.'
        ],
        tasksCount: 4,
        completedTasksCount: 3,
        status: 'Activo',
        membersCount: 5
      },
      {
        id: 'com-pol-3',
        coordinationId: 'coord-politica',
        name: 'Comité de Movilización y Participación Ciudadana',
        leadPerson: 'Prof. Marina Peñaranda',
        responsibilities: [
          'Diseñar estrategias para movilizar a los ciudadanos y fomentar su participación en eventos y actividades de la campaña.',
          'Organizar programas de capacitación y promover la participación cívica de la comunidad.'
        ],
        tasksCount: 5,
        completedTasksCount: 3,
        status: 'En Ejecución',
        membersCount: 12
      }
    ]
  },
  {
    id: 'coord-estrategias',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación de Estrategias',
    coordinatorName: 'Hugo Rubio',
    coordinatorRole: 'Director de Estrategia Electoral & Discurso',
    coordinatorPhone: '+57 312 889 0123',
    coordinatorEmail: 'hugo.rubio@campana2026.org',
    color: '#7c3aed', // Purple
    iconName: 'Target',
    summary: 'Investigación del contexto político-social, diseño de materiales de campaña coherentes y relacionamiento estratégico con medios.',
    committees: [
      {
        id: 'com-est-1',
        coordinationId: 'coord-estrategias',
        name: 'Comité de Investigación y Análisis Estratégico',
        leadPerson: 'Hugo Rubio',
        responsibilities: [
          'Realizar investigaciones y análisis para identificar oportunidades y desafíos en el contexto político y social.',
          'Proporcionar recomendaciones estratégicas basadas en los hallazgos de investigación.'
        ],
        tasksCount: 5,
        completedTasksCount: 4,
        status: 'Activo',
        membersCount: 6
      },
      {
        id: 'com-est-2',
        coordinationId: 'coord-estrategias',
        name: 'Comité de Diseño y Producción de Materiales de Campaña',
        leadPerson: 'Carolina Mestre',
        responsibilities: [
          'Diseñar y producir materiales de campaña, como volantes, carteles, banners y otros recursos visuales.',
          'Garantizar que los materiales sean coherentes con la identidad visual de la campaña y transmitan el mensaje de manera efectiva.'
        ],
        tasksCount: 8,
        completedTasksCount: 6,
        status: 'En Ejecución',
        membersCount: 9
      },
      {
        id: 'com-est-3',
        coordinationId: 'coord-estrategias',
        name: 'Comité de Relaciones con Medios de Comunicación',
        leadPerson: 'Felipe Quintero',
        responsibilities: [
          'Establecer y mantener relaciones con medios de comunicación, periodistas y blogueros locales.',
          'Organizar ruedas de prensa, entrevistas y difundir comunicados de prensa para maximizar la cobertura mediática de la campaña.'
        ],
        tasksCount: 4,
        completedTasksCount: 2,
        status: 'Activo',
        membersCount: 4
      }
    ]
  },
  {
    id: 'coord-comunicacion',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación de Comunicación',
    coordinatorName: 'Sandra Gutiérrez',
    coordinatorRole: 'Directora de Comunicaciones, Prensa & Marketing',
    coordinatorPhone: '+57 315 771 2345',
    coordinatorEmail: 'sandra.gutierrez@campana2026.org',
    color: '#0284c7', // Sky Blue
    iconName: 'MessageSquare',
    summary: 'Estrategia de redes sociales, producción audiovisual de alta calidad y gestión de relaciones públicas con la comunidad.',
    committees: [
      {
        id: 'com-com-1',
        coordinationId: 'coord-comunicacion',
        name: 'Comité de Redes Sociales y Marketing Digital',
        leadPerson: 'Sandra Gutiérrez',
        responsibilities: [
          'Gestionar y desarrollar estrategias de redes sociales y marketing digital para promover la campaña.',
          'Crear y publicar contenido atractivo, interactuar con los seguidores y monitorear el impacto de las acciones en línea.'
        ],
        tasksCount: 10,
        completedTasksCount: 7,
        status: 'En Ejecución',
        membersCount: 8
      },
      {
        id: 'com-com-2',
        coordinationId: 'coord-comunicacion',
        name: 'Comité de Diseño Gráfico y Producción Audiovisual',
        leadPerson: 'Mateo Osorio',
        responsibilities: [
          'Diseñar gráficos, infografías, videos y otros elementos visuales para fortalecer la presencia de la campaña en línea y fuera de línea.',
          'Coordinar la producción de materiales audiovisuales de alta calidad que transmitan el mensaje de la campaña de manera efectiva.'
        ],
        tasksCount: 7,
        completedTasksCount: 5,
        status: 'Activo',
        membersCount: 7
      },
      {
        id: 'com-com-3',
        coordinationId: 'coord-comunicacion',
        name: 'Comité de Comunicación Externa y Relaciones Públicas',
        leadPerson: 'Valeria Cárdenas',
        responsibilities: [
          'Gestionar la comunicación externa de la campaña, incluyendo relaciones con la prensa, eventos públicos y colaboraciones con organizaciones externas.',
          'Promover una imagen positiva y construir relaciones sólidas con diferentes actores sociales y grupos de interés.'
        ],
        tasksCount: 4,
        completedTasksCount: 3,
        status: 'Activo',
        membersCount: 5
      }
    ]
  },
  {
    id: 'coord-juridica',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación Jurídica',
    coordinatorName: 'Luis R Diaz',
    coordinatorRole: 'Director Jurídico, Normativo & Litigio Electoral',
    coordinatorPhone: '+57 318 992 4567',
    coordinatorEmail: 'luis.diaz@campana2026.org',
    color: '#d97706', // Amber / Gold
    iconName: 'Scale',
    summary: 'Blindaje normativo CNE, observación electoral de derechos humanos, defensa judicial y código de ética de campaña.',
    committees: [
      {
        id: 'com-jur-1',
        coordinationId: 'coord-juridica',
        name: 'Comité Legal y Normativo',
        leadPerson: 'Luis R Diaz',
        responsibilities: [
          'Asesorar sobre aspectos legales y normativos relacionados con la campaña y la participación política.',
          'Asegurar el cumplimiento de las leyes electorales y proporcionar orientación en materia de regulaciones y requisitos legales.'
        ],
        tasksCount: 6,
        completedTasksCount: 5,
        status: 'Activo',
        membersCount: 4
      },
      {
        id: 'com-jur-2',
        coordinationId: 'coord-juridica',
        name: 'Comité de Observación Electoral y Derechos Humanos',
        leadPerson: 'Abg. Claudia Méndez',
        responsibilities: [
          'Monitorear y garantizar la transparencia y equidad en el proceso electoral.',
          'Proteger los derechos humanos y asegurar el respeto por los principios democráticos durante la campaña.'
        ],
        tasksCount: 4,
        completedTasksCount: 2,
        status: 'En Ejecución',
        membersCount: 6
      },
      {
        id: 'com-jur-3',
        coordinationId: 'coord-juridica',
        name: 'Comité de Asesoría Jurídica y Litigio',
        leadPerson: 'Dr. Fernando Salgado',
        responsibilities: [
          'Brindar asesoría jurídica a la campaña en caso de disputas legales, reclamaciones o controversias.',
          'Representar legalmente a la campaña en litigios electorales y defender sus derechos e intereses.'
        ],
        tasksCount: 3,
        completedTasksCount: 2,
        status: 'Activo',
        membersCount: 4
      },
      {
        id: 'com-jur-4',
        coordinationId: 'coord-juridica',
        name: 'Comité de Ética y Disciplina',
        leadPerson: 'Dra. Leonor Valdivia',
        responsibilities: [
          'Velar por el cumplimiento de los principios éticos y los estándares de conducta en la campaña.',
          'Establecer protocolos de actuación para resolver conflictos y garantizar un ambiente de trabajo respetuoso y ético.',
          'Realizar investigaciones internas en casos de conducta inapropiada y tomar medidas disciplinarias según corresponda.'
        ],
        tasksCount: 3,
        completedTasksCount: 3,
        status: 'Completado',
        membersCount: 5
      }
    ]
  },
  {
    id: 'coord-finanzas',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación de Finanzas',
    coordinatorName: 'Juan C Velaides',
    coordinatorRole: 'Gerente Financiero, Tesorería & Cuentas Claras',
    coordinatorPhone: '+57 311 663 8901',
    coordinatorEmail: 'juan.velaides@campana2026.org',
    color: '#059669', // Emerald
    iconName: 'DollarSign',
    summary: 'Recaudación de fondos, presupuesto y gestión de gastos bajo topes legales CNE y auditorías de transparencia.',
    committees: [
      {
        id: 'com-fin-1',
        coordinationId: 'coord-finanzas',
        name: 'Comité de Recaudación de Fondos y Donaciones',
        leadPerson: 'Juan C Velaides',
        responsibilities: [
          'Diseñar estrategias para recaudar fondos y obtener donaciones para financiar la campaña.',
          'Establecer relaciones con posibles donantes y coordinar eventos de recaudación de fondos.'
        ],
        tasksCount: 6,
        completedTasksCount: 4,
        status: 'En Ejecución',
        membersCount: 5
      },
      {
        id: 'com-fin-2',
        coordinationId: 'coord-finanzas',
        name: 'Comité de Presupuesto, Control y Gestión de Gastos',
        leadPerson: 'C.P. Mónica Arrieta',
        responsibilities: [
          'Supervisar y gestionar el presupuesto de la campaña, asegurando un uso adecuado y transparente de los recursos financieros.',
          'Llevar registros financieros precisos y presentar informes periódicos sobre el estado financiero de la campaña.'
        ],
        tasksCount: 8,
        completedTasksCount: 7,
        status: 'Activo',
        membersCount: 6
      },
      {
        id: 'com-fin-3',
        coordinationId: 'coord-finanzas',
        name: 'Comité de Auditoría y Transparencia Financiera',
        leadPerson: 'Dr. Roberto Cuello',
        responsibilities: [
          'Realizar auditorías internas para garantizar la transparencia y la integridad en la gestión financiera de la campaña.',
          'Proporcionar informes de auditoría y asegurar el cumplimiento de las normas contables y legales en relación con las finanzas de la campaña.'
        ],
        tasksCount: 4,
        completedTasksCount: 3,
        status: 'Activo',
        membersCount: 4
      }
    ]
  },
  {
    id: 'coord-voluntariado',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación de Voluntariado',
    coordinatorName: 'Fabio Delgado',
    coordinatorRole: 'Coordinador General de Voluntariado & Red Comunitaria',
    coordinatorPhone: '+57 314 220 7890',
    coordinatorEmail: 'fabio.delgado@campana2026.org',
    color: '#ea580c', // Orange
    iconName: 'HeartHandshake',
    summary: 'Reclutamiento, capacitación, brigadas de salud comunitaria, motivación y despliegue del voluntariado.',
    committees: [
      {
        id: 'com-vol-1',
        coordinationId: 'coord-voluntariado',
        name: 'Comité de Reclutamiento y Selección de Voluntarios',
        leadPerson: 'Fabio Delgado',
        responsibilities: [
          'Diseñar estrategias de reclutamiento para atraer a voluntarios comprometidos con la campaña.',
          'Realizar el proceso de selección y asignación de tareas a los voluntarios.'
        ],
        tasksCount: 7,
        completedTasksCount: 5,
        status: 'En Ejecución',
        membersCount: 15
      },
      {
        id: 'com-vol-2',
        coordinationId: 'coord-voluntariado',
        name: 'Comité de Capacitación y Orientación de Voluntarios',
        leadPerson: 'Sonia Restrepo',
        responsibilities: [
          'Desarrollar programas de capacitación para los voluntarios, brindando información sobre la campaña y las tareas asignadas.',
          'Orientar a los voluntarios sobre las políticas y procedimientos de la campaña.'
        ],
        tasksCount: 5,
        completedTasksCount: 4,
        status: 'Activo',
        membersCount: 8
      },
      {
        id: 'com-vol-3',
        coordinationId: 'coord-voluntariado',
        name: 'Comité de Coordinación de Actividades de Voluntariado',
        leadPerson: 'Julián Vergara',
        responsibilities: [
          'Coordinar las actividades y tareas asignadas a los voluntarios.',
          'Asegurar una distribución equitativa de las tareas y el seguimiento efectivo de las actividades.'
        ],
        tasksCount: 9,
        completedTasksCount: 6,
        status: 'En Ejecución',
        membersCount: 20
      },
      {
        id: 'com-vol-4',
        coordinationId: 'coord-voluntariado',
        name: 'Comité de Reconocimiento y Motivación de Voluntarios',
        leadPerson: 'Paola Durán',
        responsibilities: [
          'Reconocer y valorar el trabajo de los voluntarios, incentivando su participación y compromiso.',
          'Implementar iniciativas de motivación, como eventos de agradecimiento y certificados de reconocimiento.'
        ],
        tasksCount: 3,
        completedTasksCount: 2,
        status: 'Planificación',
        membersCount: 5
      },
      {
        id: 'com-vol-5',
        coordinationId: 'coord-voluntariado',
        name: 'Comité de Salud',
        leadPerson: 'Dra. Milena Chinchilla (Médica)',
        responsibilities: [
          'Identificar y coordinar la colaboración con proveedores de servicios de salud locales.',
          'Facilitar el acceso de la comunidad a servicios de salud, como consultas médicas, exámenes y medicamentos.',
          'Brindar información y orientación sobre recursos de salud disponibles.'
        ],
        tasksCount: 6,
        completedTasksCount: 4,
        status: 'En Ejecución',
        membersCount: 10
      }
    ]
  },
  {
    id: 'coord-logistica',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación de Logística',
    coordinatorName: 'Flor Palmezano',
    coordinatorRole: 'Directora de Operaciones Logísticas, Transporte & Día D',
    coordinatorPhone: '+57 317 554 3210',
    coordinatorEmail: 'flor.palmezano@campana2026.org',
    color: '#0d9488', // Teal
    iconName: 'Truck',
    summary: 'Gestión de eventos masivos, flota de movilización y transporte rural/urbano, suministros y seguridad.',
    committees: [
      {
        id: 'com-log-1',
        coordinationId: 'coord-logistica',
        name: 'Comité de Gestión de Eventos y Logística',
        leadPerson: 'Flor Palmezano',
        responsibilities: [
          'Planificar y coordinar los eventos de la campaña, asegurando una ejecución exitosa.',
          'Gestionar la logística, incluyendo la reserva de espacios, el suministro de equipos y la coordinación de proveedores.'
        ],
        tasksCount: 11,
        completedTasksCount: 8,
        status: 'En Ejecución',
        membersCount: 18
      },
      {
        id: 'com-log-2',
        coordinationId: 'coord-logistica',
        name: 'Comité de Movilización y Transporte',
        leadPerson: 'Jaime Rincón',
        responsibilities: [
          'Organizar la movilización y transporte de los equipos de campaña, asegurando su desplazamiento efectivo.',
          'Coordinar los recursos de transporte necesarios para los eventos y actividades.'
        ],
        tasksCount: 8,
        completedTasksCount: 6,
        status: 'Activo',
        membersCount: 14
      },
      {
        id: 'com-log-3',
        coordinationId: 'coord-logistica',
        name: 'Comité de Gestión de Recursos',
        leadPerson: 'Ernesto Villegas',
        responsibilities: [
          'Gestionar los recursos materiales y de suministros necesarios para la campaña.',
          'Asegurar la disponibilidad y el uso eficiente de los recursos.',
          'Recolección de datos y monitoreo de inventarios.'
        ],
        tasksCount: 6,
        completedTasksCount: 4,
        status: 'Activo',
        membersCount: 7
      },
      {
        id: 'com-log-4',
        coordinationId: 'coord-logistica',
        name: 'Comité de Seguridad',
        leadPerson: 'Cap. (R) Gilberto Morales',
        responsibilities: [
          'Identificar y evaluar los riesgos de seguridad en los eventos y actividades de la campaña.',
          'Diseñar y ejecutar planes de seguridad que incluyan medidas de prevención, mitigación y respuesta.',
          'Coordinar con las autoridades locales y proveedores de seguridad para garantizar la seguridad de los participantes y el equipo de campaña.'
        ],
        tasksCount: 5,
        completedTasksCount: 4,
        status: 'Activo',
        membersCount: 9
      }
    ]
  },
  {
    id: 'coord-jovenes',
    tenantId: 'organizacion-prd-renovacion-democratica',
    title: 'Coordinación de Jóvenes',
    coordinatorName: 'Carlos Patino',
    coordinatorRole: 'Líder General de Juventudes & Activismo Digital',
    coordinatorPhone: '+57 319 887 6543',
    coordinatorEmail: 'carlos.patino@campana2026.org',
    color: '#e11d48', // Rose / Red
    iconName: 'Sparkles',
    summary: 'Mítines y caravanas juveniles, tendencias virales en redes, formación de nuevos liderazgos y banco de propuestas jóvenes.',
    committees: [
      {
        id: 'com-jov-1',
        coordinationId: 'coord-jovenes',
        name: 'Comité de Eventos y Actividades Juveniles',
        leadPerson: 'Carlos Patino',
        responsibilities: [
          'Planificar y coordinar eventos y actividades de la campaña, como mítines, caravanas, reuniones comunitarias y debates.',
          'Gestionar la logística de los eventos, incluyendo la reserva de espacios, el suministro de equipos y la coordinación del personal.',
          'Garantizar que los eventos y actividades se desarrollen de manera efectiva y cumplan con los objetivos establecidos.'
        ],
        tasksCount: 7,
        completedTasksCount: 5,
        status: 'En Ejecución',
        membersCount: 22
      },
      {
        id: 'com-jov-2',
        coordinationId: 'coord-jovenes',
        name: 'Comité de Comunicación y Redes Sociales Juveniles',
        leadPerson: 'Daniela Giraldo',
        responsibilities: [
          'Desarrollar y ejecutar estrategias de comunicación para promover la campaña a través de diferentes canales, como redes sociales, sitios web y medios tradicionales.',
          'Crear contenido atractivo y relevante que transmita el mensaje de la campaña de manera efectiva.',
          'Gestionar y mantener actualizadas las cuentas de redes sociales y responder a los comentarios y consultas de los seguidores.'
        ],
        tasksCount: 9,
        completedTasksCount: 7,
        status: 'Activo',
        membersCount: 16
      },
      {
        id: 'com-jov-3',
        coordinationId: 'coord-jovenes',
        name: 'Comité de Liderazgo y Formación',
        leadPerson: 'Esteban Rueda',
        responsibilities: [
          'Identificar y desarrollar líderes dentro de la campaña, brindándoles capacitación y orientación para fortalecer sus habilidades de liderazgo.',
          'Organizar programas de formación y empoderamiento para el equipo de campaña, fomentando la toma de decisiones y la resolución de problemas efectiva.',
          'Promover un ambiente de trabajo colaborativo y motivador que inspire a los miembros del equipo a alcanzar su máximo potencial.'
        ],
        tasksCount: 4,
        completedTasksCount: 3,
        status: 'Activo',
        membersCount: 11
      },
      {
        id: 'com-jov-4',
        coordinationId: 'coord-jovenes',
        name: 'Comité de Recopilación de Opiniones y Propuestas',
        leadPerson: 'Laura Vanessa Pérez',
        responsibilities: [
          'Diseñar y aplicar métodos para recopilar opiniones y propuestas de la comunidad en relación con las políticas y estrategias de la campaña.',
          'Analizar y sintetizar la información recopilada para identificar tendencias y patrones que informen la toma de decisiones de la campaña.',
          'Asegurar que las voces de la comunidad sean escuchadas y consideradas en el desarrollo de las propuestas y acciones de la campaña.'
        ],
        tasksCount: 5,
        completedTasksCount: 4,
        status: 'En Ejecución',
        membersCount: 8
      }
    ]
  }
];

export const DEMO_GRASSROOTS_VOTERS: GrassrootsVoter[] = [
  {
    id: 'votante-101',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Ana Cecilia Gómez',
    documentNumber: 'CC 49.882.109',
    phone: '3128901122',
    department: 'Cesar',
    municipality: 'Astrea',
    sector: 'Arjona (Corregimiento)',
    pollingStation: 'I.E. Álvaro Araujo Noguera - Sede Arjona',
    tableNumber: 2,
    leaderId: 'lider-teresa-arjona-astrea-corregimiento',
    leaderName: 'Doña Teresa Arjona V.',
    candidateId: 'candidato-jose-antonio-arjona-concejo-astrea',
    candidateName: 'Don José Antonio Arjona (Concejo)',
    supportLevel: 5,
    requiresTransport: true,
    notes: 'Compromiso confirmado. Madre comunitaria influyente en el sector La Ceiba.',
    registeredAt: '2026-08-01T10:00:00Z',
    verified: true
  },
  {
    id: 'votante-102',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Jorge Eliecer Mindiola',
    documentNumber: 'CC 77.401.992',
    phone: '3156678899',
    department: 'Cesar',
    municipality: 'Astrea',
    sector: 'Arjona (Corregimiento)',
    pollingStation: 'I.E. Álvaro Araujo Noguera - Sede Arjona',
    tableNumber: 1,
    leaderId: 'lider-teresa-arjona-astrea-corregimiento',
    leaderName: 'Doña Teresa Arjona V.',
    candidateId: 'candidato-jose-antonio-arjona-concejo-astrea',
    candidateName: 'Don José Antonio Arjona (Concejo)',
    supportLevel: 5,
    requiresTransport: false,
    notes: 'Parcelero de la vereda El Retiro. Vota en mesa 1 junto a 4 familiares.',
    registeredAt: '2026-08-02T11:30:00Z',
    verified: true
  },
  {
    id: 'votante-103',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Marta Luz Quintero',
    documentNumber: 'CC 39.551.204',
    phone: '3189901234',
    department: 'Cesar',
    municipality: 'Astrea',
    sector: 'San Isidro (Vereda)',
    pollingStation: 'Escuela Rural Mixta San Isidro',
    tableNumber: 1,
    leaderId: 'lider-gonzalo-sepulveda-astrea-san-isidro',
    leaderName: 'Gonzalo Sepúlveda M.',
    candidateId: 'candidato-mateo-benitez-alcaldia-astrea',
    candidateName: 'Ing. Mateo Benítez R. (Alcaldía)',
    supportLevel: 4,
    requiresTransport: true,
    notes: 'Requiere apoyo de camioneta para salir de la finca a las 9:00 AM.',
    registeredAt: '2026-08-03T14:15:00Z',
    verified: true
  },
  {
    id: 'votante-104',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Pedro Antonio Cuello',
    documentNumber: 'CC 12.788.341',
    phone: '3104456789',
    department: 'Cesar',
    municipality: 'Astrea',
    sector: 'San Isidro (Vereda)',
    pollingStation: 'Escuela Rural Mixta San Isidro',
    tableNumber: 2,
    leaderId: 'lider-gonzalo-sepulveda-astrea-san-isidro',
    leaderName: 'Gonzalo Sepúlveda M.',
    candidateId: 'candidato-mateo-benitez-alcaldia-astrea',
    candidateName: 'Ing. Mateo Benítez R. (Alcaldía)',
    supportLevel: 5,
    requiresTransport: false,
    notes: 'Presidente JAC San Isidro. Coordina grupo de 15 votantes.',
    registeredAt: '2026-08-04T09:00:00Z',
    verified: true
  },
  {
    id: 'votante-105',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Yuris Paola Beleño',
    documentNumber: 'CC 1.065.882.110',
    phone: '3205567788',
    department: 'Cesar',
    municipality: 'El Paso',
    sector: 'La Loma (Corregimiento Minero)',
    pollingStation: 'Colegio Nacionalizado La Loma',
    tableNumber: 4,
    leaderId: 'lider-carlos-cantillo-el-paso-la-loma',
    leaderName: 'Carlos Cantillo F.',
    candidateId: 'candidato-sandra-cantillo-concejo-el-paso',
    candidateName: 'Dra. Sandra Milena Cantillo (Concejo)',
    supportLevel: 5,
    requiresTransport: false,
    notes: 'Líder juvenil barrio El Carmen. Difusora en WhatsApp y TikTok.',
    registeredAt: '2026-08-04T16:20:00Z',
    verified: true
  },
  {
    id: 'votante-106',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Luis Carlos Villazón',
    documentNumber: 'CC 77.199.045',
    phone: '3138879900',
    department: 'Cesar',
    municipality: 'El Paso',
    sector: 'La Loma (Corregimiento Minero)',
    pollingStation: 'Colegio Nacionalizado La Loma',
    tableNumber: 3,
    leaderId: 'lider-carlos-cantillo-el-paso-la-loma',
    leaderName: 'Carlos Cantillo F.',
    candidateId: 'candidato-lucia-mendoza-alcaldia-el-paso',
    candidateName: 'Dra. Lucía Mendoza H. (Alcaldía)',
    supportLevel: 4,
    requiresTransport: true,
    notes: 'Trabajador del sector contratista. Comprometido con la propuesta de salud.',
    registeredAt: '2026-08-05T08:45:00Z',
    verified: true
  },
  {
    id: 'votante-107',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Carmen Rosa Estrada',
    documentNumber: 'CC 49.330.129',
    phone: '3167789012',
    department: 'Cesar',
    municipality: 'El Paso',
    sector: 'Cuatro Vientos (Corregimiento)',
    pollingStation: 'Concentración Escolar Cuatro Vientos',
    tableNumber: 1,
    leaderId: 'lider-patricia-valenzuela-el-paso-cuatro-vientos',
    leaderName: 'Patricia Valenzuela',
    candidateId: 'candidato-lucia-mendoza-alcaldia-el-paso',
    candidateName: 'Dra. Lucía Mendoza H. (Alcaldía)',
    supportLevel: 5,
    requiresTransport: true,
    notes: 'Artesana y comerciante de la troncal. Reclama pavimentación de calle principal.',
    registeredAt: '2026-08-05T11:10:00Z',
    verified: true
  },
  {
    id: 'votante-108',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Dairo José Daza',
    documentNumber: 'CC 12.990.412',
    phone: '3114456789',
    department: 'Cesar',
    municipality: 'Bosconia',
    sector: 'Barrio El Carmen / Terminal',
    pollingStation: 'I.E. Carlos Restrepo Araujo',
    tableNumber: 5,
    leaderId: 'lider-hernan-tapia-bosconia-centro',
    leaderName: 'Don Hernán Tapia L.',
    candidateId: 'candidato-carlos-vives-alcaldia-bosconia',
    candidateName: 'Dr. Carlos Eduardo Vives (Alcaldía)',
    supportLevel: 5,
    requiresTransport: false,
    notes: 'Comerciante mayorista. Apoya caravana de cierre.',
    registeredAt: '2026-08-05T14:30:00Z',
    verified: true
  },
  {
    id: 'votante-109',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Sonia Patricia Baquero',
    documentNumber: 'CC 49.800.771',
    phone: '3178890123',
    department: 'Cesar',
    municipality: 'Valledupar',
    sector: 'Comuna 5: Los Cortijos',
    pollingStation: 'Universidad Popular del Cesar (UPC Sabanas)',
    tableNumber: 12,
    leaderId: 'lider-alvaro-maestre-valledupar-la-nevada',
    leaderName: 'Álvaro Maestre',
    candidateId: 'candidato-maria-fernanda-orozco-alcaldia-valledupar',
    candidateName: 'Dra. María Fernanda Orozco (Alcaldía)',
    supportLevel: 5,
    requiresTransport: false,
    notes: 'Docente universitaria. Articuladora del voto joven y femenino.',
    registeredAt: '2026-08-06T10:00:00Z',
    verified: true
  },
  {
    id: 'votante-110',
    tenantId: 'organizacion-prd-renovacion-democratica',
    fullName: 'Jhonatan Smith Oñate',
    documentNumber: 'CC 1.065.993.441',
    phone: '3196654321',
    department: 'Cesar',
    municipality: 'Valledupar',
    sector: 'Comuna 5: La Nevada',
    pollingStation: 'Colegio Técnico La Nevada',
    tableNumber: 8,
    leaderId: 'lider-alvaro-maestre-valledupar-la-nevada',
    leaderName: 'Álvaro Maestre',
    candidateId: 'candidato-valentina-silva-asamblea-cesar',
    candidateName: 'Dra. Valentina Silva M. (Asamblea)',
    supportLevel: 4,
    requiresTransport: true,
    notes: 'Voto fiel de asamblea y gobernación. Apoya brigadas juveniles.',
    registeredAt: '2026-08-06T15:00:00Z',
    verified: true
  }
];
