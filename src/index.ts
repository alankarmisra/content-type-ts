/*
https://datatracker.ietf.org/doc/html/rfc7231#section-3.1.1.1

media-type = type "/" subtype *( OWS ";" OWS parameter )
type = token
subtype = token
The type/subtype MAY be followed by parameters in the form of name=value pairs.
parameter = token "=" ( token / quoted-string )

https://datatracker.ietf.org/doc/html/rfc7230#section-3.2.6
token  = 1*tchar
tchar  = "!" / "#" / "$" / "%" / "&" / "'" / "*"
        / "+" / "-" / "." / "^" / "_" / "`" / "|" / "~"
        / DIGIT / ALPHA
        ; any VCHAR, except delimiters 
quoted-string  = DQUOTE *( qdtext / quoted-pair ) DQUOTE
qdtext         = HTAB / SP /%x21 / %x23-5B / %x5D-7E / obs-text
obs-text       = %x80-FF        
quoted-pair    = "\" ( HTAB / SP / VCHAR / obs-text )
*/

// regexp to recognize %x80-FF from rfc

import { MediaType } from './media-type'

const tokenRegexSource = `(?:[a-zA-Z0-9!#$%&'*+.^_\`|~-]+)`;

const qdtextRegexSource = '[\\t !#-\\[\\]-~\\u0080-\\u00FF]';
const quotedPairRegexSource = '\\\\([\\t !-~\\u0080-\\u00FF])';
const quotedStringRegexSource = `"(?:(?:${quotedPairRegexSource}|${qdtextRegexSource})*)"`;

const parameterRegexSource = ` *(?:${tokenRegexSource} *= *(?:${tokenRegexSource}|${quotedStringRegexSource})) *`;

const typeRegexSource = `${tokenRegexSource}\\/${tokenRegexSource}`;

const tokenRegex = new RegExp(`^${tokenRegexSource}$`);
const quotedPairRegex = new RegExp(quotedPairRegexSource, 'g');
const parameterPartsRegex = new RegExp(` *;? *(?<key>${tokenRegexSource}) *= *(?<value>(?:${tokenRegexSource}|${quotedStringRegexSource})) *`, 'g');

const typeRegex = new RegExp(`^${typeRegexSource}$`);

const mediaTypeRegex = new RegExp(
  `^ *(?<type>${typeRegexSource}) *`
  + `(?<parameters>(?: *; *${parameterRegexSource})*) *$`);

const InvalidMediaTypeError = new TypeError('Invalid media type');

/**
 * Parse the given media type string or Request object and return the parsed media type and its parameters.
 *
 * @param {string | Request} mediaType - The media type string or Request object to be parsed
 * @return {MediaType} The parsed media type and its parameters
 */
export function parse(mediaType: string | Request): MediaType {
  if (!(mediaType && (typeof mediaType === 'string' || mediaType instanceof Request))) {
    throw InvalidMediaTypeError;
  }

  const mediaTypeString = mediaType instanceof Request ? mediaType.headers.get('content-type') : mediaType;
  if (!mediaTypeString) {
    throw InvalidMediaTypeError;
  }

  const parts = mediaTypeString.match(mediaTypeRegex);

  if (!parts?.groups) {
    throw InvalidMediaTypeError;
  }

  const { type, parameters } = parts.groups as { type: string, parameters: string };

  // Could be that the rest of the string is non-empty isn't a valid parameters string
  if (!parameters && type.length != mediaTypeString.trim().length) {
    throw InvalidMediaTypeError;
  }

  let match;
  const parameterParts: { [key: string]: string } = {};

  let lastIndex = 0;

  while ((match = parameterPartsRegex.exec(parameters)) !== null) {
    const { key, value } = match.groups as { key: string, value: string };

    if (!key || !value) {
      throw InvalidMediaTypeError;
    }

    let cleanValue = value.startsWith('"') ? value.slice(1, -1) : value;
    cleanValue = cleanValue.replace(quotedPairRegex, '$1');
    parameterParts[key.toLowerCase()] = cleanValue;

    lastIndex = parameterPartsRegex.lastIndex;
  }

  // Check if there are characters left over at the end of the parameters string
  if (lastIndex < parameters.length) {
    throw InvalidMediaTypeError;
  }

  return { type: type.toLowerCase(), parameters: parameterParts };
}

export function format(mediaType: MediaType): string {

  // Ensure that mediaType has valid properties for js checks
  if (typeof mediaType !== 'object' || mediaType === null || typeof mediaType.type !== 'string') {
    throw InvalidMediaTypeError;
  }

  // Check if mediaType.type is valid
  if (!typeRegex.test(mediaType.type)) {
    throw InvalidMediaTypeError;
  }

  // Start with the type and subtype
  let formatted = mediaType.type;

  if (mediaType.parameters) {
    // If mediaType has parameters, ensure it is of the correct type
    if (typeof mediaType.parameters !== 'object') {
      throw InvalidMediaTypeError;
    }

    // Process each parameter, appending it to the result string
    const parameters = Object.entries(mediaType.parameters)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => {
        // Ensure the key is in valid format
        if (!tokenRegex.test(key)) {
          throw InvalidMediaTypeError;
        }

        // Determine if quoting is needed by checking if the value matches the token regex
        const needsQuoting = !tokenRegex.test(value); // If it doesn't match, it needs quoting
        const formattedValue = needsQuoting ? `"${value.replace(/"/g, '\\"')}"` : value;
        const valueRegEx = new RegExp(`^(?:${tokenRegexSource}|${quotedStringRegexSource})$`);

        // Ensure the value is in valid format
        if (value && !valueRegEx.test(formattedValue)) {
          throw InvalidMediaTypeError;
        }

        return `${key}=${formattedValue}`;
      });

    // Join all parameters with a semicolon and a space, then append to the type/subtype
    if (parameters.length > 0) {
      formatted += '; ' + parameters.join('; ');
    }
  }

  return formatted;
}
