// Textos legales de los consentimientos de Social. Si se cambia el texto,
// hay que subir CONSENT_VERSION: así consta qué versión aceptó cada persona.
export const CONSENT_VERSION = "v2";

export const CONSENT_METRICAS = {
  title: "Compartir tus métricas con amigos",
  paragraphs: [
    "Para usar la sección Amigos necesitas aceptar que tus amigos aceptados puedan ver, en modo solo lectura, tu rango, tu racha y tus métricas de estudio: horas por crédito, minutos totales, número de asignaturas, el desglose por asignatura y tu historial de estudio.",
    "Solo lo verán las personas a las que aceptes como amigas y que a su vez hayan aceptado compartir las suyas. Nadie podrá modificar tus datos.",
    "Tu foto de perfil (la de tu cuenta de Google o la que subas tú) será visible para otros usuarios en la búsqueda y en la clasificación de tus amigos. Si prefieres que vean solo tu inicial, puedes ocultarla en Ajustes.",
    "Las notas solo se muestran si activas esa opción en Ajustes. Puedes retirar este permiso cuando quieras desde Ajustes y dejarán de verte al instante.",
  ],
  accept: "Aceptar",
  decline: "Rechazar",
};

export const CONSENT_RANKING = {
  title: "Aparecer en el listado de aprobados",
  paragraphs: [
    "Si aceptas, aparecerás en el listado de aprobados de las asignaturas que hayas aprobado, con tu nombre de usuario, tus horas por crédito, tu nota, tu desgaste máximo y los cursos que necesitaste.",
    "Solo verán el listado los usuarios que también hayan aceptado aparecer en él. Puedes retirar este permiso cuando quieras desde Ajustes y desaparecerás al instante.",
  ],
  accept: "Aceptar",
  decline: "Ahora no",
};

export const STATS_PRIVACY_NOTE =
  "Las estadísticas de la comunidad se calculan de forma agregada y anónima a partir de los datos de todos los usuarios. Al principio pueden basarse en muy pocas personas.";
