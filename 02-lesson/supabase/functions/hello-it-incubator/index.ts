export default {
  fetch(req: Request) {
    if (req.method !== 'GET') {
      return Response.json(
          {message: 'Method not allowed'},
          {
            status: 405,
            headers: {
              Allow: 'GET'
            }
          }
      )
    }

    return Response.json({
      message: 'Hello Dimych! Hello it incubator',
      studentId: 5213
    })
  }
}