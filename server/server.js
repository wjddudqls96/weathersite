const express = require("express");
const app = express();
const port = 3001;
const cors = require("cors");
const bodyparser = require("body-parser");
const mysql = require("mysql");
// nodemailer 모듈 요청
const nodemailer = require("nodemailer");
//salt 암호화 모듈
const crypto = require("crypto");
var http = require("http").createServer(app);

var connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "2ajrrhtlvj",
  database: "mydb",
});

connection.connect();
//bodyparser및 cors 사용
app.use(bodyparser.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyparser.json());

// 아이디 중복체크
app.post("/CheckId", (req, res) => {
  const checkId = req.body.check_Id;
  connection.query("SELECT user_id FROM user_info WHERE user_id =(?)", [checkId], function (err, rows, fields) {
    if (rows[0] === undefined) {
      res.send(true); //중복 없음 사용가능
    } else {
      res.send(false); // 중복 있음 사용안됨
    }
  });
});

// 회원가입 salt를 이용한 hash 암호화
app.post("/Signup", async function (req, res, next) {
  let body = req.body;
  let inputPassword = body.passwd;
  let salt = Math.round(new Date().valueOf() * Math.random()) + "";
  let hashPassword = crypto
    .createHash("sha512")
    .update(inputPassword + salt)
    .digest("hex");
  connection.query("insert into user_info (user_id,user_salt, user_passwd, user_email) values (?,?,?,?)", [body.id, salt, hashPassword, body.email], function (err, rows, fields) {
    if (err) {
      console.log("sign_up error");
      res.send(false);
    } else {
      res.send(true);
    }
  });
});

//로그인 salt 적용
app.post("/login", async function (req, res, next) {
  let body = req.body;
  let dbPassword;
  let salt;
  connection.query("SELECT user_key,user_id,user_salt,user_passwd FROM user_info WHERE user_id = (?)", [body.id], function (err, rows, fields) {
    console.log(rows);
    if (rows === undefined || rows[0] === undefined) {
      res.send(false);
    } else {
      dbPassword = rows[0].user_passwd;
      salt = rows[0].user_salt;
      let inputPassword = body.passwd;

      let hashPassword = crypto
        .createHash("sha512")
        .update(inputPassword + salt)
        .digest("hex");
      if (dbPassword === hashPassword) {
        console.log("비밀번호 일치");

        res.send(rows);
      } else {
        console.log("비밀번호 불일치");
        res.send(false);
      }
    }
  });
});

app.post("/getCity", (req, res) => {
  let state = req.body.state;
  connection.query("SELECT DISTINCT second FROM api_data WHERE first = (?)", [state], function (err, rows, fields) {
    console.log(rows);
    res.send(rows);
  });
});

app.post("/getCity2", (req, res) => {
  let body = req.body;
  connection.query("SELECT DISTINCT third FROM api_data WHERE first = (?) and second = (?)", [body.city1, body.city2], function (err, rows, fields) {
    console.log(rows);
    res.send(rows);
  });
});

app.post("/getCity3", (req, res) => {
  let body = req.body;
  connection.query("SELECT nx, ny FROM api_data WHERE first = (?) and second = (?) and third = (?)", [body.city1, body.city2, body.city3], function (err, rows, fields) {
    console.log(rows);
    res.send(rows);
  });
});

app.post("/Sendmail", (req, res) => {
  const email = req.body.sendEmail;
  var authNum = Math.floor(Math.random() * 1000000) + 100000;
  if (authNum > 1000000) {
    authNum = authNum - 100000;
  }

  let emailParam = {
    toEmail: email,
    subject: "회원가입 인증 메일입니다.",
    text: `<body style="margin: 0; padding: 0">
    <div style="font-family:Apple SD Gothic Neo, sans-serif ; width: 540px; height: 600px; border-top: 4px solid #6f9df1;>
      <h1 style=" margin: 0; padding: 0 5px; font-size: 28px; font-weight: 400">
      <span style="font-size: 20px; margin: 0 0 10px 3px">창원대 우산알리미</span>
      <b style="color: #6f9df1">메일인증</b> 안내입니다.
      </h1>
      <p style="font-size: 16px; line-height: 26px; margin-top: 50px; padding: 0 5px; ">
        안녕하세요.
        <b style="color: #6f9df1">우산알리미</b>에 가입해 주셔서 진심으로
        감사드립니다.
        아래 <b style="color: #6f9df1">'인증 번호'</b>를 입력하여 회원가입을 완료해주세요.
        감사합니다. <br />
        인증번호: ${authNum}
        <script>
          document.write(authNumber);
        </script>
      </p>
      <a style="color: #fff; text-decoration: none; text-align: center" href="{$auth_url}" target="_blank">
        <p style="display: inline-block; width: 210px; height: 45px; margin: 30px 5px 40px; background: #2d73f5; line-height: 45px; vertical-align: middle; font-size: 16px;" class="move_wagle">우산알리미 홈페이지 이동</p>
      </a>
    </div>
  </body>`
  };
  console.log("인증번호는 " + authNum + "입니다.");
  connection.query("SELECT user_email FROM user_info WHERE user_email = (?)", [email], function (err, rows, fields) {
    if (rows[0] === undefined) {
      //중복된 메일 없음 메일 발송
      mailSender.sendGmail(emailParam);
      res.send(authNum.toString());
    } else {
      //중복된 메일이 있음
      res.send(true);
    }
  });
});

app.post("/storeData", (req, res) => {
  let body = req.body;
  console.log(body);
  connection.query("update user_info set user_sendtime =(?), user_state=(?) where user_key= (?)", [body[0], "1", body[6]], function (err, rows, fields) {
    connection.query("SELECT user_key FROM location_table WHERE user_key = (?)", body[6], function (err, rows, fields) {
      if (rows[0] === undefined) {
        connection.query("insert into location_table (state,city, address, nx,ny, user_key) values (?,?,?,?,?,?)", [body[1], body[2], body[3], body[4], body[5], body[6]], function (err, rows, fields) {});
      } else {
        connection.query("update location_table set state=(?), city=(?), address=(?), nx=(?),ny=(?) where user_key=(?)", [body[1], body[2], body[3], body[4], body[5], body[6]], function (err, rows, fields) {});
      }
    });
  });
});
app.post("/cancelstate", (req, res) => {
  let body = req.body;
  connection.query("update user_info set user_state=(?) where user_key=(?)", [0, body], function (err, rows, fields) {});
});
var mailSender = {
  // 메일발송 함수
  sendGmail: function (param) {
    var transporter = nodemailer.createTransport({
      service: "gmail",
      prot: 587,
      host: "smtp.gmail.com",
      secure: false,
      requireTLS: true,
      auth: {
        user: "cwnunight@gmail.com",
        pass: "a2586974",
      },
    });
    // 메일 옵션
    var mailOptions = {
      from: "gjdnjsdud10@gmail.com",
      to: param.toEmail, // 수신할 이메일
      subject: param.subject, // 메일 제목
      text: param.text, // 메일 내용
    };
    // 메일 발송
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
  },
};

http.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
