import got from 'got';

export default async function verifyReCaptcha(captchaResponse: string, secret: string): Promise<boolean> {
  const response = await got.post<{
    success: boolean,
    challenge_ts: string,
    hostname: string,
    'error-codes': string[],
  }>('https://www.google.com/recaptcha/api/siteverify', {
    responseType: 'json',
    form: {
      secret,
      response: captchaResponse,
    },
  });

  return response.body.success;
}
