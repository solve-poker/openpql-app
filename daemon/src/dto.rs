use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ParseReq {
    pub src: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "ok")]
pub enum ParseResp {
    #[serde(rename = "true")]
    Ok { stmts: usize },
    #[serde(rename = "false")]
    Err { message: String },
}

#[derive(Debug, Deserialize)]
pub struct RangeReq {
    pub game: String,
    pub text: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "ok")]
pub enum RangeResp {
    #[serde(rename = "true")]
    Ok,
    #[serde(rename = "false")]
    Err { message: String },
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ClientMsg {
    Run {
        src: String,
        #[serde(rename = "runId", default)]
        run_id: Option<u64>,
    },
    Cancel,
}

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ServerMsg {
    Started {
        #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
        run_id: Option<u64>,
    },
    Stdout {
        line: String,
        #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
        run_id: Option<u64>,
    },
    Stderr {
        line: String,
        #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
        run_id: Option<u64>,
    },
    Done {
        #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
        run_id: Option<u64>,
    },
    Error {
        message: String,
        #[serde(rename = "runId", skip_serializing_if = "Option::is_none")]
        run_id: Option<u64>,
    },
}
