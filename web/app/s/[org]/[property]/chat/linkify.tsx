import { Fragment } from "react";

const ID_PATH = /(\/id\/[0-9a-f]{64})/;

// The payment acknowledgement carries a relative /id/<token> path (the
// database doesn't know the site origin). Render exactly that shape as a
// same-origin link; everything else stays text.
export function LinkifiedBody({ body }: { body: string }) {
  return (
    <>
      {body.split(ID_PATH).map((part, index) =>
        ID_PATH.test(part) ? (
          <a key={index} href={part} className="chat-link">Upload your ID</a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
