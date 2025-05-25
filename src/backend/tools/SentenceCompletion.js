import nlp from 'compromise'

class SentenceCompletion {
  static detectLanguage(text) {
    const languagePatterns = {
      es: /\b(sí|si|no|vale|bueno|quizás|tal vez|definitivamente|absolutamente|nunca|siempre|exacto|correcto|incorrecto|verdad|falso|bien|mal|genial|gracias|por favor|perdón|hola|adiós|el|la|los|las|un|una|de|en|con|por|para|que|es|son|está|están)\b/i,
      fr: /\b(oui|non|ok|d'accord|peut-être|définitivement|absolument|jamais|toujours|exactement|correct|incorrect|vrai|faux|bien|mal|génial|merci|s'il vous plaît|pardon|bonjour|au revoir|le|la|les|un|une|de|en|avec|pour|que|est|sont)\b/i,
      de: /\b(ja|nein|ok|okay|sicher|vielleicht|definitiv|absolut|nie|immer|genau|richtig|falsch|wahr|gut|schlecht|toll|danke|bitte|entschuldigung|hallo|auf wiedersehen|der|die|das|ein|eine|von|in|mit|für|dass|ist|sind)\b/i,
      it: /\b(sì|si|no|ok|okay|forse|definitivamente|assolutamente|mai|sempre|esatto|corretto|sbagliato|vero|falso|bene|male|fantastico|grazie|per favore|scusa|ciao|arrivederci|il|la|lo|gli|le|un|una|di|in|con|per|che|è|sono)\b/i,
    }

    for (const [lang, pattern] of Object.entries(languagePatterns)) {
      if (pattern.test(text)) {
        return lang
      }
    }

    return 'en'
  }

  static isComplete(text, language = 'auto') {
    console.log('Checking if sentence is complete:', text)
    if (!text || text.trim().length === 0) {
      return false
    }

    const trimmedText = text.trim()
    const detectedLang =
      language === 'auto' ? this.detectLanguage(trimmedText) : language

    const hasPunctuation = /[.!?]$/.test(trimmedText)

    const languageIncompletePatterns = {
      en: [
        /\b(and|but|or|because|since|although|if|when|while|that|which|who)\s*$/i,
        /\b(the|a|an|this|that|these|those)\s*$/i,
        /\b(in|on|at|to|for|with|from|by|about|through)\s*$/i,
        /\b(is|are|was|were|will|would|could|should|can|may|might)\s*$/i,
        /\b(to)\s*$/i,
      ],
      es: [
        /\b(y|pero|o|porque|desde|aunque|si|cuando|mientras|que|cual|quien)\s*$/i,
        /\b(el|la|los|las|un|una|este|esta|eso|aquell?o?s?)\s*$/i,
        /\b(en|a|para|con|por|desde|hacia|sobre|entre)\s*$/i,
        /\b(es|son|era|fueron|será|serían|podría|debería|puede|quizás)\s*$/i,
      ],
      fr: [
        /\b(et|mais|ou|parce que|depuis|bien que|si|lorsque|pendant|qui|que)\s*$/i,
        /\b(le|la|les|un|une|ce|cette|ces)\s*$/i,
        /\b(à|dans|pour|avec|par|de|depuis|sur|entre)\s*$/i,
        /\b(est|sont|était|étaient|sera|serait|pourrait|devrait|peut|peut-être)\s*$/i,
      ],
      de: [
        /\b(und|aber|oder|weil|seit|obwohl|wenn|als|während|dass|welche|wer)\s*$/i,
        /\b(der|die|das|ein|eine|dies|jene)\s*$/i,
        /\b(in|an|zu|für|mit|von|durch|über)\s*$/i,
        /\b(ist|sind|war|waren|wird|würde|könnte|sollte|kann|könnten)\s*$/i,
      ],
      it: [
        /\b(e|ma|o|perché|da|sebbene|se|quando|mentre|che|quale|chi)\s*$/i,
        /\b(il|la|i|le|un|una|questo|quello)\s*$/i,
        /\b(in|a|per|con|da|di|su|tra)\s*$/i,
        /\b(è|sono|era|erano|sarà|sarebbe|potrebbe|dovrebbe|può|potrebbe)\s*$/i,
      ],
    }

    const patterns =
      languageIncompletePatterns[detectedLang] || languageIncompletePatterns.en
    const hasIncompletePattern = patterns.some((pattern) =>
      pattern.test(trimmedText)
    )

    const validShortAnswers = {
      en: /^(yes|no|ok|okay|sure|maybe|perhaps|definitely|absolutely|never|always|exactly|correct|wrong|true|false|right|good|bad|great|fine|thanks|please|sorry|hello|hi|bye|goodbye)\.?$/i,
      es: /^(sí|si|no|vale|bueno|quizás|tal vez|definitivamente|absolutamente|nunca|siempre|exacto|correcto|incorrecto|verdad|falso|bien|mal|genial|gracias|por favor|perdón|hola|adiós)\.?$/i,
      fr: /^(oui|non|ok|d'accord|peut-être|définitivement|absolument|jamais|toujours|exactement|correct|incorrect|vrai|faux|bien|mal|génial|merci|s'il vous plaît|pardon|bonjour|au revoir)\.?$/i,
      de: /^(ja|nein|ok|okay|sicher|vielleicht|definitiv|absolut|nie|immer|genau|richtig|falsch|wahr|gut|schlecht|toll|danke|bitte|entschuldigung|hallo|auf wiedersehen)\.?$/i,
      it: /^(sì|si|no|ok|okay|forse|definitivamente|assolutamente|mai|sempre|esatto|corretto|sbagliato|vero|falso|bene|male|fantastico|grazie|per favore|scusa|ciao|arrivederci)\.?$/i,
    }

    if (
      validShortAnswers[detectedLang] &&
      validShortAnswers[detectedLang].test(trimmedText)
    ) {
      return true
    }

    const doc = nlp(trimmedText)
    const hasSubject = doc.has('#Noun') || doc.has('#Pronoun')
    const hasVerb = doc.has('#Verb')
    const minLength = trimmedText.length >= 3

    return (
      hasPunctuation &&
      !hasIncompletePattern &&
      hasSubject &&
      hasVerb &&
      minLength
    )
  }
}

export default SentenceCompletion
